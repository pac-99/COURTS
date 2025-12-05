# Google API Setup Instructions

To enable the interactive map and Google Sign-In features, you need to set up Google API keys.

## 1. Google Maps API Key

### Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Maps JavaScript API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Maps JavaScript API"
   - Click "Enable"
4. Create credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy your API key
5. (Optional but recommended) Restrict the API key:
   - Click on your API key to edit it
   - Under "Application restrictions", select "HTTP referrers"
   - Add your website URL (e.g., `https://pac-99.github.io/*`)
   - Under "API restrictions", select "Restrict key" and choose "Maps JavaScript API"
   - Click "Save"

### Update in Code:
Open `index.html` and replace `YOUR_API_KEY_HERE` on line 16 with your actual API key:
```javascript
const GOOGLE_MAPS_API_KEY = "YOUR_ACTUAL_API_KEY_HERE";
```

## 2. Google Sign-In (OAuth 2.0 Client ID)

### Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select the same project you used for Maps API
3. Go to "APIs & Services" → "Credentials"
4. Click "Create Credentials" → "OAuth client ID"
5. If prompted, configure the OAuth consent screen:
   - Choose "External" (unless you have a Google Workspace)
   - Fill in the required information
   - Add your email as a test user
6. Create OAuth client ID:
   - Application type: "Web application"
   - Name: "COURTS App" (or any name)
   - Authorized JavaScript origins:
     - `https://pac-99.github.io` (for GitHub Pages)
     - `http://localhost:8000` (for local development)
   - Authorized redirect URIs:
     - `https://pac-99.github.io` (for GitHub Pages)
     - `http://localhost:8000` (for local development)
   - Click "Create"
7. Copy the **Client ID** (it looks like: `123456789-abc.apps.googleusercontent.com`)

### Update in Code:
Open `index.html` and replace `YOUR_CLIENT_ID.apps.googleusercontent.com` on line 17 with your actual Client ID:
```javascript
const GOOGLE_CLIENT_ID = "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com";
```

## 3. Optional: Custom Map ID

If you want to use a custom styled map:
1. Go to [Google Maps Platform](https://console.cloud.google.com/google/maps-apis)
2. Click "Map Styles" → "Create Map Style"
3. Customize your map style
4. Copy the Map ID
5. Update in `index.html` line 18:
```javascript
const GOOGLE_MAP_ID = "YOUR_MAP_ID";
```

## Testing

After adding your API keys:
1. Save `index.html`
2. Commit and push to GitHub:
   ```bash
   git add index.html
   git commit -m "Add Google API keys"
   git push origin main
   ```
3. Wait a few minutes for GitHub Pages to update
4. Clear your browser cache and refresh the page
5. The map should now be interactive and Google Sign-In should work

## Troubleshooting

- **Map not showing**: Check browser console for errors. Verify API key is correct and Maps JavaScript API is enabled.
- **Sign-In not working**: Verify Client ID is correct and OAuth consent screen is configured. Check that your domain is in authorized origins.
- **API key errors**: Make sure you've enabled the correct APIs and the key isn't restricted incorrectly.

## Security Notes

- **Never commit API keys to public repositories** if they're unrestricted
- Always restrict API keys to specific domains/APIs in production
- Consider using environment variables or a backend service to hide keys in production apps

