# Quick Issue - Chrome Extension

A Chrome extension to quickly create GitHub issues with page context and screenshots.

![Quick Issue Main Interface](images/popup.png)

## Features

- **Quick issue creation**: Just type the description, title is auto-generated
- **Page context**: Automatically captures current page title and URL
- **Screenshots**: Capture full tab or select a region to include
- **Selected text**: If you select text on a page before opening, it's included as a quote
- **Issue types**: Choose between Bug or Enhancement
- **Configurable**: Set your own repository and optional project board
- **Minimal UI**: Fast and focused on the task

## Installation

### From Source (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension-quick-issue` folder
5. The extension should appear in your toolbar

### Create Icons (Optional)

The extension works without icons, but you can add them:

1. Create an `icons` folder
2. Add PNG icons at 16x16, 48x48, and 128x128 pixels

## Setup

1. Click the extension icon
2. On first use, settings will be shown automatically
3. Configure your repository:
   - **Repository Owner**: GitHub username or organization (e.g., `octocat`)
   - **Repository Name**: Name of the repo (e.g., `my-project`)
   - **Project ID** (optional): GitHub Project V2 ID (e.g., `PVT_kwDOxxxxxx`)
4. Add your GitHub Personal Access Token
   - Needs `repo` scope (and `project` scope if using project integration)
   - [Create a token here](https://github.com/settings/tokens/new?scopes=repo,project&description=Quick%20Issue)
5. Settings are saved locally in Chrome storage

![Settings Panel](images/settings.png)

## Usage

1. Navigate to any page related to your issue (optional)
2. Select text on the page to quote it (optional)
3. Click the extension icon
4. Optionally capture a screenshot (full tab or selected region)
5. Choose issue type: Bug or Enhancement
6. Type your issue description
7. Check/uncheck "Include page context"
8. Click "Create Issue"

The title is automatically generated from:
- The first line of your description, OR
- The first sentence if the first line is too long

## Screenshots

### Capturing Screenshots

![Screenshot Capture](images/screenshot-capture.png)

- **Capture Tab**: Takes a screenshot of the entire visible tab
- **Select Region**: Lets you crop a specific area

Screenshots are uploaded to Imgur and embedded in the issue.

## Issue Format

Created issues include:

```markdown
[Your description]

### Screenshot
![Screenshot](https://i.imgur.com/xxxxx.png)

---

**Context:**
- Page: [Page Title]
- URL: [Page URL]
```

## Project Integration

If you configure a Project ID, issues will automatically be added to your GitHub Project board with:
- **Issue type** field set based on your selection
- **Status** field set to "Ready"

To find your Project ID:
1. Open your GitHub Project
2. Use the GitHub GraphQL API Explorer or browser dev tools to find the `PVT_` prefixed ID

## Troubleshooting

**"Failed to create issue"**: Check that your token has `repo` scope and hasn't expired.

**"Please configure repository"**: Open settings and enter your repository owner and name.

**Can't capture page content**: Some pages (chrome://, extension pages) don't allow content scripts.

**Screenshot upload failed**: Imgur may be temporarily unavailable. Try again later.

**Project integration fails**: Ensure your token has `project` scope and the Project ID is correct.
