Featured in the Book of Abstracts, DARIAH AE 2025 | The Past https://doi.org/10.5281/zenodo.16411471

Project by Tobias Kreten and Svend Göke, supervised by Johanna Störiko as part of the Master's program in Digital Humanities at the University of Göttingen.

Sample pages retrieved from the University of Heidelberg. https://digi.ub.uni-heidelberg.de/diglit/jugend

Important: The app needs model_weights.pth in the backend folder to run

This app was written and tested with Python 3.12

# Installation:

## Backend:

 - Open the path of the backend folder of the repository in your terminal

**Create a virtual environment:**

 - python3 -m venv venv
 - source venv/bin/activate
 - pip install -r requirements.txt | make sure that all packages support
   are supported by your Python version

Configure Database credentials in the code

**Set up Database:**
***Required:*** 

 - Install and initalize the MySQL-Server.
 - Recommended: Install MySQLWorkbench.
 - Adjust the respective paths in the database.py file.
 - Change the MySQL database credentials and set your own values for the
   host, user, password, and database (Make sure that the input data
   matches the credentials used when setting up the MySQL server).
 - Run the database.py code.

Start MySQLWorkbench if you want to check the setup.

## **Frontend:**

*node.js is required*

 - npm install (installs the package.json dependencies for react)

**Start the App:**

 - flask run (starts the backend on localhost:5000)

 - npm start (starts the frontend on localhost:3000)

# **About the NewNa Segmentation App**

This app makes use of and draws inspiration from the Newspaper Navigator by Benjamin Charles Germain Lee 
https://github.com/LibraryOfCongress/newspaper-navigator
https://news-navigator.labs.loc.gov

NewNa Segmentation focuses on advertisements, though all other classes are still featured, and transfers
the Newspaper Navigator approach (trained and build for American Newspaper) to historic German Magazines.
The goal was to evaluate the model in this context of a different datasource and build an interactive app around it.

We make use of the provided model weights in the backend to receive predicted bounding boxes.
These bounding boxes can then be fully edited, as in deleted, resized, filtered and converted to other classes by the user.
We thus create a fusion of the benefits of the strengths of machine leaning through the automated computation and 
the human interaction to easily modify and correct mistakes.

We offer two modes of use, both natively part of the app, you simply decide on the landing page via a toggle.
Upload Only and Database Mode.
Upload Only offers all functionality of editing the predicted bounding boxes, but is intended for smaller use cases and faster sessions.
You can download the annotations in a structured JSON file in the coco format and the segmented sections of your uploaded page as PNG cutouts.

Database Mode requires you to have a running MySQL Server in the background. We provide the codes for an exemplary setup of a large collection of
"Die Jugend", a historical German Magazine. In this mode you can directly save edits into this database and display a ground truth (when existing for the page/not available in the current release).

# Abstract of the Project:

This project, titled NewNa Segmentation App, evaluated the zero-shot capabilities of an existing De-
tectron2 model and developed an application to facilitate manual correction and expand training data to
improve model performance. The automatic segmentation of advertisements from historical newspapers
and magazines presents a challenge for Optical Layout Recognition models trained on editorial news-
paper pages. While models for this task are lacking, the Newspaper Navigator Model (Lee et al. 2020;
Lee and Weld 2020) offers a promising approach for detecting visual material in American historical
newspapers. However, its effectiveness on other printed media, such as German cultural magazines from
around 1900, remains uncertain. Well-segmented data is essential for further digital analyses, such as
using multimodal models.
The Newspaper Navigator Model was tested on 1,789 pages from the German cultural magazine “Die
Jugend.” A manually annotated ground truth dataset was created and converted into COCO format for
consistency. The dataset was provided by our supervisor, Johanna Störiko, who annotated the data as
part of her PhD dissertation at the Georg-August-Universität Göttingen, based on scans from the Uni-
versity Library Heidelberg (https://doi.org/10.11588/diglit.3565). Initial results showed that while the
model could detect advertisements, its accuracy was only around 63%, measured using Intersection over
Union (IoU) with a 0.5 threshold, along with precision and recall, from which an F1-score was derived.
This relatively low accuracy highlighted the need for a tool that enables efficient correction and anno-
tation, reducing the effort required to generate high-quality training data. To address this, we developed
an interactive segmentation application integrating the model with a MySQL database and providing an
intuitive user interface. Figure 1 shows the database schema, which stores annotated advertisements and
complete pages. Users can modify bounding boxes, delete incorrect predictions and add new segmenta-
tions.
To enhance usability, the application includes an interactive category legend, and a toggle function be-
tween modes of operation. An Upload-Only mode lets users upload pages, segment them and download
results as structured JSON files and segmented images. The Database mode, designed for large-scale
dataset creation, enables direct storage of segmented advertisements with metadata. This structured ap-
proach supports systematic data curation and model improvements. The evaluation showed that inte-
grating machine learning predictions into an annotation tool streamlines segmentation, even when model
accuracy is suboptimal. By embedding automated suggestions in a friendly interface, annotation work-
load is reduced while generating high-quality training data in a still human-driven interpretation.
This application demonstrates how pre-trained models can be adapted and reused in different research
contexts. By integrating model predictions into an annotation tool, time can be saved while generating
labeled data for future model training. Unlike many tools, this application is tailored for advertisement
segmentation, making it highly optimized for its use case. At the same time, its flexible architecture
allows adaptation to other image segmentation tasks, provided outputs are structured in COCO format.
This flexibility offers a promising avenue for further research in automated document analysis and dig-
ital humanities. The NewNa Segmentation App is not just a technical innovation but a tool that enhances
humanities research questions.

# Bibliography

jstoeriko. (2023, September 19). Erkennen von Varianten historischer Werbeanzeigen mit CLIP und
ChromaDB. Göttingen Edition Lab. Retrieved March 14, 2025, from https://editionlab.hypotheses.org/304

Lee, B., & Weld, D. (2020). Newspaper Navigator: Open Faceted Search for 1.5 Million Images. UIST
‘20 Adjunct: Proceedings of the 33rd Annual ACM Symposium on User Interface Software and
Technology, 120–122. https://doi.org/10.1145/3379350.3416143

Lee, B., Jin, B., Hu, J., & Weld, D. (2020). The Newspaper Navigator Dataset: Extracting Headlines and
Visual Content from 16 Million Historic Newspaper Pages in Chronicling America. CIKM ‘20:
Proceedings of the 29th ACM International Conference on Information & Knowledge Manage-
ment, 3055–3062. https://doi.org/10.1145/3340531.3412767

Ehrmann, M., et al. (2020). Combining Visual and Textual Features for Semantic Segmentation of His-
torical Newspaper. arXiv. https://arxiv.org/pdf/2002.06144

Smits, T., & Wevers, M. (2023). A multimodal turn in Digital Humanities: Using contrastive machine
learning models to explore, enrich, and analyze digital visual historical collections. Digital
Scholarship in the Humanities, 38(3), 1267–1280. https://doi.org/10.1093/llc/fqad008j

Wevers, M. (2023). Mining historical advertisements in digitised newspapers. In E. Bunout, M. Ehr-
mann, & F. Clavert (Eds.), Digitised Newspapers – A New Eldorado for Historians?: Reflections
on Tools, Methods and Epistemology (pp. 227–252). De Gruyter Oldenbourg.
https://doi.org/10.1515/9783110729214-011


