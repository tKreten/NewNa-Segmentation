# app.py

#IMPORTS & SETUP
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import torch
import mysql.connector
from mysql.connector import errorcode
import json
import os
import logging
from detectron2.engine import DefaultPredictor
from detectron2.config import get_cfg

# Configure logging for debugging and traceability.
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# Initialize the Flask app and enable CORS for localhost:3000 (your React front-end).
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# CONFIGURATION
# Paths for the Detectron2 configuration file and model weights.
CONFIG_FILE_PATH = "/your_path/backend/faster_rcnn_R_50_FPN_3x.yaml"
MODEL_WEIGHTS_PATH = "/your_path/backend/model_weights.pth"

# Define the class names corresponding to the model's categories.
CLASS_NAMES = [
    "Photograph",
    "Illustration",
    "Map",
    "Comic/Cartoon",
    "Editorial Cartoon",
    "Headline",
    "Advertisement"
]

# Database configuration settings.
DB_HOST = "localhost"
DB_USER = "root"
DB_PASSWORD = "your_password"
DB_NAME = "Jugend"


# DATABASE FUNCTIONS
def get_db_connection():
    """
    Attempts to create and return a MySQL database connection.
    If an error occurs (e.g., invalid credentials, database does not exist),
    logs the error and returns None.
    """
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        logging.debug("DB connection established.")
        return conn
    except mysql.connector.Error as err:
        if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
            logging.error("Invalid DB credentials.")
        elif err.errno == errorcode.ER_BAD_DB_ERROR:
            logging.error("DB does not exist.")
        else:
            logging.error(f"DB connection error: {err}")
        return None


def strip_extension(filename):
    """
    Removes the file extension from a filename.
    This is used to create a consistent identifier when storing pages.
    """
    base, _ = os.path.splitext(filename)
    return base


def get_or_create_ganzeseiten(stripped_file_name):
    """
    Checks if an entry in the GanzeSeiten table exists for the given stripped file name.
    If it does, returns the corresponding id.
    If it doesn't, creates a new row with default values (width, height = 0, year and nr empty)
    and returns the new id.

    Problem:
      - Ensuring that a page exists for annotations to reference via a foreign key.
    Solution:
      - Automatically create a page entry if it doesn't exist.
    """
    conn = get_db_connection()
    if not conn:
        return None
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM GanzeSeiten WHERE file_name = %s", (stripped_file_name,))
        row = cursor.fetchone()
        if row:
            return row[0]

        # Create new entry if not found.
        insert_page_sql = """
          INSERT INTO GanzeSeiten (file_name, width, height, year, nr)
          VALUES (%s, 0, 0, '', '')
        """
        cursor.execute(insert_page_sql, (stripped_file_name,))
        new_id = cursor.lastrowid
        conn.commit()
        logging.debug(f"Auto-created GanzeSeiten row => id={new_id}, file_name='{stripped_file_name}'")
        return new_id
    except mysql.connector.Error as err:
        logging.error(f"Error get_or_create_ganzeseiten: {err}")
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()


# MODEL SETUP
# Configure and initialize the Detectron2 predictor for segmentation.
cfg = get_cfg()
cfg.merge_from_file(CONFIG_FILE_PATH)
cfg.MODEL.WEIGHTS = MODEL_WEIGHTS_PATH
cfg.MODEL.ROI_HEADS.SCORE_THRESH_TEST = 0.5
cfg.MODEL.ROI_HEADS.NUM_CLASSES = len(CLASS_NAMES)
cfg.MODEL.DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
predictor = DefaultPredictor(cfg)
logging.debug("Detectron2 predictor init.")


#API ENDPOINTS
@app.route("/segment", methods=["POST"])
def segment():
    """
    Endpoint to process an image upload for segmentation.

    How It Works:
      - Retrieves the mode from the form ("upload_only" or "database").
      - Reads the uploaded image file and decodes it using OpenCV.
      - Uses the Detectron2 predictor to perform inference and generate bounding boxes.
      - Calculates the width, height, and percentage of the page each box occupies.
      - Returns the predictions as a JSON response.

    Note:
      The bbox coordinates, width, height, and percent_page are computed here.
      These values are correct and are also used for JSON export.
    """
    mode = request.form.get("mode", "upload_only")
    if "file" not in request.files:
        return jsonify({"error": "No file in request"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    stripped_file_name = strip_extension(file.filename)

    try:
        img_bytes = file.read()
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({"error": "Invalid image file"}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to read image: {e}"}), 500

    try:
        outputs = predictor(img)
    except Exception as e:
        logging.error(f"Model error: {e}")
        return jsonify({"error": "Inference error"}), 500

    boxes_tensor = outputs["instances"].pred_boxes.tensor
    cats = outputs["instances"].pred_classes
    predictions = []

    # Process each predicted bounding box.
    for i in range(len(boxes_tensor)):
        box_arr = boxes_tensor[i].cpu().numpy().tolist()
        cat_id = cats[i].cpu().item()
        w = box_arr[2] - box_arr[0]
        h = box_arr[3] - box_arr[1]
        area = w * h
        full_area = float(img.shape[0] * img.shape[1]) or 1.0
        percent_page = area / full_area

        predictions.append({
            "image_id": i + 1,
            "category_id": cat_id,
            "bbox": box_arr,
            "file_name": stripped_file_name,
            "width": w,
            "height": h,
            "percent_page": percent_page
        })

    msg = f"{'Database' if mode == 'database' else 'Upload Only'} Mode - processed."
    return jsonify({"predictions": predictions, "message": msg}), 201


@app.route("/save", methods=["POST"])
def save_annotations():
    """
    Endpoint to save bounding box annotations into the database.

    How It Works:
      - Expects a JSON payload containing a "file_name" and an "annotations" array.
      - Each annotation should include bounding box coordinates, width, height, and percent_page.

    Problem Encountered:
      - When storing new pages into the database, the width and height for each box were always 0.
      - However, saving as a JSON file contained the correct width and height.

    Solution:
      - We ensure that the payload includes explicit width and height values.
      - The backend extracts these values from each annotation (using ann.get("width") and ann.get("height"))
        and stores them in the database.
      - The file_name stored in the Anzeigen table is not used for the join but is kept for reference.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body"}), 400

    raw_file_name = data.get("file_name", "")
    stripped_file_name = strip_extension(raw_file_name)
    annotations = data.get("annotations", [])
    if not stripped_file_name or not annotations:
        return jsonify({"error": "Missing file_name or annotations"}), 400

    page_id = get_or_create_ganzeseiten(stripped_file_name)
    if page_id is None:
        return jsonify({"error": "Could not get/create GanzeSeiten row."}), 500

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "DB conn fail"}), 500
    cursor = conn.cursor()
    try:
        insert_sql = """
          INSERT INTO Anzeigen (Key_id, category_id, bbox, file_name, width, height, percent_page)
          VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        for ann in annotations:
            cat_id = ann["category_id"]
            bbox_json = json.dumps(ann["bbox"])
            # Retrieve width and height from the annotation payload.
            w_val = ann.get("width", 0)
            h_val = ann.get("height", 0)
            pp_val = ann.get("percent_page", 0.0)
            # Use the provided file_name or default to the stripped file name.
            boxFN = ann.get("file_name", stripped_file_name)

            cursor.execute(insert_sql, (
                page_id, cat_id, bbox_json, boxFN, w_val, h_val, pp_val
            ))
        conn.commit()
        return jsonify({"message": "Annotations saved to DB successfully!"}), 201
    except mysql.connector.Error as err:
        conn.rollback()
        logging.error(f"Insert error: {err}")
        return jsonify({"error": str(err)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route("/ground_truth", methods=["POST"])
def get_ground_truth_boxes():
    """
    Endpoint to retrieve ground truth bounding boxes from the database.

    How It Works:
      - Expects a JSON payload with "file_name".
      - Uses the stripped file name to join the Anzeigen table with GanzeSeiten.
      - Returns the ground truth boxes with calculated width and height.

    Note:
      The width and height are computed from the stored bbox coordinates.
    """
    data = request.get_json()
    raw_file_name = data.get("file_name", "")
    if not raw_file_name:
        return jsonify({"error": "File name is required"}), 400

    stripped_file_name = strip_extension(raw_file_name)

    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "DB conn fail"}), 500
    cursor = conn.cursor()
    try:
        query = """
          SELECT 
            Anzeigen.category_id,
            Anzeigen.bbox,
            Anzeigen.width,
            Anzeigen.height,
            Anzeigen.percent_page
          FROM Anzeigen
          JOIN GanzeSeiten ON Anzeigen.Key_id = GanzeSeiten.id
          WHERE GanzeSeiten.file_name = %s
        """
        cursor.execute(query, (stripped_file_name,))
        rows = cursor.fetchall()
        result = []
        for i, row in enumerate(rows):
            cat_id = row[0]
            bbox_json = json.loads(row[1])
            w_val = row[2]
            h_val = row[3]
            pp_val = row[4]

            # Compute width and height from bbox coordinates
            x1, y1, x2, y2 = bbox_json
            result.append({
                "id": f"gt-{i}",
                "category_id": cat_id,
                "x": x1,
                "y": y1,
                "width": x2 - x1,
                "height": y2 - y1,
                "percent_page": pp_val,
                "isGroundTruth": True  # Note: Boolean value True
            })

        return jsonify({"ground_truth_boxes": result}), 200
    except Exception as e:
        conn.rollback()
        logging.error(f"Error in ground_truth: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/save_all', methods=['POST'])
def save_all():
    """
    Endpoint to save multiple pages and their annotations into the database.
    How It Works:
      1. Insert or update each page in the GanzeSeiten table.
         - If a page (file_name) already exists, update its metadata.
         - Otherwise, insert a new row.
         - A mapping of file_name to GanzeSeiten.id is maintained.
      2. Insert annotations (bounding boxes) into the Anzeigen table.
         - Each annotation references the corresponding GanzeSeiten row via Key_id.
         - Width and height are derived from the "size" field.

    Problem & Solution:
      - The issue with width/height being 0 was addressed by ensuring we explicitly
        extract the size (width, height) from each annotation payload and store them.
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    images_data = data.get('images', [])
    annotations_data = data.get('annotations', [])
    if not images_data or not annotations_data:
        return jsonify({'error': 'Need both images[] and annotations[]'}), 400

    try:
        # Using a helper function to get a database connection that returns dictionaries.
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1) Insert or update pages into GanzeSeiten.
        file_name_to_id = {}
        for img in images_data:
            file_name_val = img.get('file_name')
            width_val = img.get('width', None)
            height_val = img.get('height', None)
            year_val = img.get('year', None)
            nr_val = img.get('nr', None)
            if not file_name_val:
                continue

            check_sql = """
                SELECT id FROM GanzeSeiten
                WHERE file_name = %s
                LIMIT 1
            """
            cursor.execute(check_sql, (file_name_val,))
            existing = cursor.fetchone()

            if existing:
                ganze_id = existing['id']
                # Optionally update metadata
                update_sql = """
                    UPDATE GanzeSeiten
                    SET width = %s, height = %s, year = %s, nr = %s
                    WHERE id = %s
                """
                cursor.execute(update_sql, (width_val, height_val, year_val, nr_val, ganze_id))
                file_name_to_id[file_name_val] = ganze_id
            else:
                insert_sql = """
                    INSERT INTO GanzeSeiten (file_name, width, height, year, nr)
                    VALUES (%s, %s, %s, %s, %s)
                """
                cursor.execute(insert_sql, (file_name_val, width_val, height_val, year_val, nr_val))
                ganze_id = cursor.lastrowid
                file_name_to_id[file_name_val] = ganze_id

        # 2) Insert annotations into Anzeigen, referencing GanzeSeiten via Key_id.
        for ann in annotations_data:
            cat_id = ann.get('category_id', None)
            bbox_list = ann.get('bbox', [])
            f_name = ann.get('file_name')  # Must match a GanzeSeiten.file_name.
            size_list = ann.get('size', [])
            perc_page = ann.get('percent_page', 0)

            # Map annotation's file_name to the corresponding GanzeSeiten id.
            ganze_id = file_name_to_id.get(f_name)
            if not ganze_id:
                continue

            # Calculate width and height from bbox coordinates.
            x1, y1, x2, y2 = bbox_list if len(bbox_list) == 4 else (0, 0, 0, 0)
            w = x2 - x1 if (x2 > x1) else 0
            h = y2 - y1 if (y2 > y1) else 0
            # Alternatively, we can use the provided "size" field.
            width_ann = size_list[0] if len(size_list) > 0 else 0
            height_ann = size_list[1] if len(size_list) > 1 else 0

            # Insert the annotation into Anzeigen.
            insert_ann_sql = """
                INSERT INTO Anzeigen
                  (category_id, bbox, file_name, width, height, percent_page, Key_id)
                VALUES
                  (%s, %s, %s, %s, %s, %s, %s)
            """
            # Convert bbox list to JSON string.
            import json as pyjson
            bbox_str = pyjson.dumps(bbox_list)

            cursor.execute(insert_ann_sql, (
                cat_id,
                bbox_str,
                f_name,
                width_ann,
                height_ann,
                perc_page,
                ganze_id
            ))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': 'Pages + Annotations saved successfully!'}), 200

    except Exception as ex:
        print("Error saving data:", ex)
        return jsonify({'error': str(ex)}), 500


#MAIN ENTRY POINT
if __name__ == '__main__':
    # Run the Flask app in debug mode.
    # In a production environment, disable debug mode and use a production server.
    app.run(debug=True)