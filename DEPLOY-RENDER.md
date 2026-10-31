# Tomboli v0.8.1 - Render Deployment

## 1. Push this folder to GitHub
Create a new GitHub repository and push the project root (the folder containing Dockerfile, render.yaml, frontend, and backend).

## 2. Render
In Render: New -> Blueprint -> connect the GitHub repository -> apply the Blueprint.

The Blueprint creates a web service and a PostgreSQL database.

## 3. Database environment variables
If Render asks for the database connection values, use the internal PostgreSQL connection details from the `tomboli-db` database. Set:
- SPRING_DATASOURCE_URL = jdbc:postgresql://<internal-host>:5432/tomboli
- SPRING_DATASOURCE_USERNAME = tomboli (or the username shown by Render)
- SPRING_DATASOURCE_PASSWORD = the database password shown by Render
- SPRING_DATASOURCE_DRIVER = org.postgresql.Driver

## 4. Deploy
After saving the environment variables, deploy/redeploy the web service. Render provides an `onrender.com` public URL.

## 5. Test
Open the public URL. Then open it from two devices/browser windows and test Remote Room.

WebSocket uses the same public host automatically: HTTPS -> WSS, HTTP -> WS.
