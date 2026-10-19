# Life & Work

A task board and daily diary that runs on your computer. All your data is saved in a folder called **Life & Work App** in your own Google Drive. You log your day by chatting with Claude.

## What you need

- A computer with [Node.js](https://nodejs.org) installed (any recent version)
- A Google account
- A Claude account with the Google Drive connector available

## 1. Start the app

1. Unzip the project.
2. Windows: double-click `start.bat`. Mac or Linux: run `sh start.sh`.
3. The browser opens after a few seconds. If it shows a blank page or "can't connect", wait a moment and refresh, or open http://localhost:5173 yourself. Keep the terminal window open while you use the app.

Click **Try demo mode** if you only want to look around. Demo data stays in your browser.

## 2. Get a Google Client ID (once, about 5 minutes)

The app needs a Client ID so Google lets it use your Drive.

1. Open [Google Cloud Console](https://console.cloud.google.com/projectcreate) and create a project. Name it anything, for example "Life and Work". Make sure this project is selected in the top bar for every step below.
2. Open the [Google Drive API page](https://console.cloud.google.com/apis/library/drive.googleapis.com) and click **Enable**.
3. Set up the consent screen. Open **APIs & Services → OAuth consent screen** (newer Google Cloud calls it **Google Auth Platform**). Click **Get started** if it shows, enter an app name and your email, choose **External** as the audience, enter your email as the contact, accept the terms, and click **Create**.
4. **Add yourself as a test user. Do not skip this.** On the same screen, open **Audience** (older screens: the **Test users** section). Make sure **Publishing status** says **Testing**. Under **Test users**, click **Add users**, type the exact Gmail address you will sign in with, and click **Save**. Check that the address now appears in the list. If it is not listed, Google blocks sign-in with "Access blocked: has not completed the Google verification process, Error 403: access_denied".
5. Create the Client ID. Go to **Credentials** (in Google Auth Platform: **Clients**) and click **Create credentials → OAuth client ID** (or **Create client**).
6. Application type: **Web application**.
7. Under **Authorised JavaScript origins**, click **Add URI** and enter `http://localhost:5173`.
8. Click **Create** and copy the **Client ID**. It ends in `.apps.googleusercontent.com`.

## 3. Connect the app to Google Drive

1. In the app, click **Set up Google Drive** and paste the Client ID. (You can also put it in `config.json` as `{ "clientId": "your-id" }` and the app will offer it automatically.)
2. Click **Save and sign in with Google** and choose the same Google account you added as a test user.
3. Google shows "Google hasn't verified this app". This is normal for your own app. Click **Advanced**, then **Go to … (unsafe)**, then allow access.

The app creates the **Life & Work App** folder in your Drive. It only reads and writes inside that folder.

## 4. Connect Claude

1. In Claude, open **Settings → Connectors** and connect **Google Drive**. Sign in with the **same Google account** you used in step 3.
2. Open **Settings → Account** and find the **Instructions for Claude** box. Paste this line and save:

   ```
   When I say "diary time", open the folder "Life & Work App" in my Google Drive, read README.md first, and follow its instructions to log my day. Ask me only the questions that are still unanswered.
   ```

   The same line is shown with a copy button in the app under **Settings → Use Claude for your diary**.

## 5. Use it

1. Start a new chat in Claude and write **diary time**.
2. Tell Claude about your day and answer its questions. It saves your answers as a small note in the `inbox` folder of the Drive folder.
3. Open the app (or come back to its tab). It reads the note, saves the day, and deletes the note. If a note is invalid, the app shows a message and keeps it in the `inbox` folder.

To add or change work tasks, tell Claude in the same chat, for example "add a task to finish the report by Friday".

## Settings to fill in

In the app's **Settings**: your name, time zone, currency, daily goals (water, steps, pages, calories), a daily spending allowance, an optional PIN lock, and a calorie calculator that works out a daily target from your weight, height and goal.

## Troubleshooting

- **Blank page or "This site can't be reached":** the terminal window must be open and say "Life & Work is running at http://localhost:5173". If it closed straight away, install Node.js and restart your computer. Also make sure you unzipped the folder first. Running `start.bat` from inside the zip does not work.

- **"Access blocked" or "Error 403: access_denied" when signing in:** the Gmail you are signing in with is not listed under Test users in the same Google Cloud project that owns your Client ID. Add it in step 2.4, click Save, wait a minute, and try again in a private window.
- **"redirect_uri_mismatch" or origin error:** the Authorised JavaScript origin must be exactly `http://localhost:5173`. Keep the app on that address.
- **Claude cannot find the folder:** make sure the Drive connector uses the same Google account as the app, and that you have signed in to the app at least once.
- **Port 5173 is already in use:** close the other program, or any older copy of this app, and start again.
