import json
import mysql.connector
import pymysql 

# This script creates a MySQL database and two related tables for storing full newspaper pages
# and annotated advertisements. It then populates the tables with data from two COCO-style JSON files,
# sets up foreign key relationships, and links annotations to their corresponding pages.

# Establish an initial connection to the MySQL server (without selecting a database)
# This is used to create the "Jugend" database if it doesn't already exist
init_conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="" # choose your own password
)
init_cursor = init_conn.cursor()
init_cursor.execute("CREATE DATABASE IF NOT EXISTS Jugend")
init_conn.commit()
init_cursor.close()
init_conn.close()

# Connect to the newly created "Jugend" database to create tables and insert data
conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="", #choose your own password
    database="Jugend"
)
cursor = conn.cursor()

# Create the "GanzeSeiten" table to store full page metadata
cursor.execute("""
CREATE TABLE IF NOT EXISTS GanzeSeiten (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    width INT,
    height INT,
    year VARCHAR(10),
    nr VARCHAR(10)
)
""")

# Create the "Anzeigen" table to store annotations for individual ads
cursor.execute("""
CREATE TABLE IF NOT EXISTS Anzeigen (
    image_id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    bbox JSON,
    file_name VARCHAR(255),
    width INT,
    height INT,
    percent_page FLOAT,
    key_id INT
)
""")

# Add a foreign key to link "Anzeigen.key_id" to "GanzeSeiten.id"
# This ensures referential integrity and enables cascading delete
try:
    cursor.execute("""
        ALTER TABLE Anzeigen 
        ADD CONSTRAINT fk_key_id 
        FOREIGN KEY (key_id) 
        REFERENCES GanzeSeiten(id) 
        ON DELETE CASCADE
    """)
except mysql.connector.Error as err:
    # If the foreign key already exists, print a notice
    print("Note (Foreign Key):", err.msg)

# Load full-page metadata from a COCO-style JSON file
with open("", "r") as file: # Set the file path to the coco_ganze_seiten.json file
    ganze_seiten_data = json.load(file)

# Insert each page entry into the "GanzeSeiten" table
for entry in ganze_seiten_data["images"]:
    cursor.execute("""
        INSERT INTO GanzeSeiten (file_name, width, height, year, nr)
        VALUES (%s, %s, %s, %s, %s)
    """, (entry['file_name'], entry['width'], entry['height'], entry['year'], entry['nr']))

# Load ad annotations from a COCO-style JSON file
with open("", "r") as file: # Set the file path to the coco_anzeigen.json file
    anzeigen_data = json.load(file)

# Insert each annotation into the "Anzeigen" table (initially with key_id = NULL)
for entry in anzeigen_data["annotations"]:
    cursor.execute("""
        INSERT INTO Anzeigen (category_id, bbox, file_name, width, height, percent_page, key_id)
        VALUES (%s, %s, %s, %s, %s, %s, NULL)
    """, (
        entry['category_id'],
        json.dumps(entry['bbox']),
        entry['file_name'],
        entry['width'],
        entry['height'],
        entry['percent_page']
    ))

# Commit changes and close the mysql-connector connection
conn.commit()
cursor.close()
conn.close()

# Open a new connection using pymysql to simplify working with dictionary-style results
connection = pymysql.connect(
    host="localhost",
    user="root",
    password="", #choose your own password
    database="Jugend",
    charset="utf8mb4",
    cursorclass=pymysql.cursors.DictCursor,
)

try:
    with connection.cursor() as cursor:
        # Load all entries from "GanzeSeiten" to create a mapping from file_name to id
        cursor.execute("SELECT id, file_name FROM GanzeSeiten")
        ganze_seiten = cursor.fetchall()
        file_name_to_id = {row["file_name"]: row["id"] for row in ganze_seiten}

        # Load all ads from the "Anzeigen" table
        cursor.execute("SELECT image_id, file_name FROM Anzeigen")
        anzeigen = cursor.fetchall()

        # For each ad, extract the path to find its corresponding full page entry
        for anzeige in anzeigen:
            original_file_name = anzeige["file_name"]
            cleaned_file_name = original_file_name.rsplit("/", 1)[0]

            # Look up the matching page ID
            key_id = file_name_to_id.get(cleaned_file_name)

            if key_id:
                # Update the ad's key_id to reference the correct page
                cursor.execute(
                    "UPDATE Anzeigen SET key_id = %s WHERE image_id = %s",
                    (key_id, anzeige["image_id"]),
                )

        # Commit all updates to the database
        connection.commit()
        print("Database setup completed successfully!")

finally:
    # Close the database connection
    connection.close()
