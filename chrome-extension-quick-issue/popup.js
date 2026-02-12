// Configuration - loaded from storage
let REPO_OWNER = '';
let REPO_NAME = '';
let PROJECT_ID = '';

// Elements
const repoOwnerInput = document.getElementById('repoOwner');
const repoNameInput = document.getElementById('repoName');
const projectIdInput = document.getElementById('projectId');
const bodyInput = document.getElementById('body');
const tokenInput = document.getElementById('token');
const submitBtn = document.getElementById('submit');
const statusDiv = document.getElementById('status');
const settingsDiv = document.getElementById('settings');
const settingsToggle = document.getElementById('settingsToggle');
const pageTitle = document.getElementById('pageTitle');
const pageUrl = document.getElementById('pageUrl');
const includeContext = document.getElementById('includeContext');
const generatedTitleDiv = document.getElementById('generatedTitle');
const captureTabBtn = document.getElementById('captureTab');
const selectRegionBtn = document.getElementById('selectRegion');
const screenshotPreview = document.getElementById('screenshotPreview');
const screenshotImg = document.getElementById('screenshotImg');
const removeScreenshotBtn = document.getElementById('removeScreenshot');

let currentTab = null;
let screenshotDataUrl = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings and token
  const stored = await chrome.storage.local.get(['githubToken', 'repoOwner', 'repoName', 'projectId', 'draftBody', 'draftType', 'draftScreenshot', 'draftIncludeContext']);
  
  // Load repo configuration
  if (stored.repoOwner) {
    REPO_OWNER = stored.repoOwner;
    repoOwnerInput.value = stored.repoOwner;
  }
  if (stored.repoName) {
    REPO_NAME = stored.repoName;
    repoNameInput.value = stored.repoName;
  }
  if (stored.projectId) {
    PROJECT_ID = stored.projectId;
    projectIdInput.value = stored.projectId;
  }
  
  // Show settings by default if required config is missing
  if (!REPO_OWNER || !REPO_NAME) {
    settingsDiv.classList.add('visible');
    settingsToggle.textContent = '⚙️ Hide Settings';
  }
  
  if (stored.githubToken) {
    tokenInput.value = stored.githubToken;
  }
  
  // Restore draft form data
  if (stored.draftBody) {
    bodyInput.value = stored.draftBody;
    // Update title preview
    const title = generateTitle(stored.draftBody);
    if (title) {
      generatedTitleDiv.textContent = `📋 Title: "${title}"`;
    }
  }
  if (stored.draftType) {
    const radio = document.querySelector(`input[name="issueType"][value="${stored.draftType}"]`);
    if (radio) radio.checked = true;
  }
  if (stored.draftScreenshot) {
    setScreenshot(stored.draftScreenshot);
  }
  if (stored.draftIncludeContext !== undefined) {
    includeContext.checked = stored.draftIncludeContext;
  }
  
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  
  pageTitle.textContent = tab.title || 'Unknown';
  pageUrl.textContent = tab.url || 'Unknown';
  
  // Check for pending screenshot from region selection
  const screenshotStored = await chrome.storage.local.get(['pendingScreenshot']);
  if (screenshotStored.pendingScreenshot) {
    setScreenshot(screenshotStored.pendingScreenshot);
    chrome.storage.local.remove('pendingScreenshot');
  }
  
  // Get selected text if any (only if no draft)
  if (!stored.draftBody) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString()
      });
      
      if (result?.result) {
        bodyInput.value = `> ${result.result}\n\n`;
        bodyInput.setSelectionRange(bodyInput.value.length, bodyInput.value.length);
        saveDraft();
      }
    } catch (_e) {
      // Can't access page content (e.g., chrome:// pages)
    }
  }
  
  bodyInput.focus();
});

// Auto-save draft on changes
function saveDraft() {
  const draftData = {
    draftBody: bodyInput.value,
    draftType: document.querySelector('input[name="issueType"]:checked')?.value || 'Bug',
    draftIncludeContext: includeContext.checked
  };
  if (screenshotDataUrl) {
    draftData.draftScreenshot = screenshotDataUrl;
  }
  chrome.storage.local.set(draftData);
}

function clearDraft() {
  chrome.storage.local.remove(['draftBody', 'draftType', 'draftScreenshot', 'draftIncludeContext']);
}

// Save on input changes
bodyInput.addEventListener('input', saveDraft);
document.querySelectorAll('input[name="issueType"]').forEach(radio => {
  radio.addEventListener('change', saveDraft);
});
includeContext.addEventListener('change', saveDraft);

// Settings toggle
settingsToggle.addEventListener('click', () => {
  settingsDiv.classList.toggle('visible');
  settingsToggle.textContent = settingsDiv.classList.contains('visible') 
    ? '⚙️ Hide Settings' 
    : '⚙️ Settings';
});

// Save settings on every keystroke (debounced)
let saveTimeout;
function saveSettings() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    REPO_OWNER = repoOwnerInput.value.trim();
    REPO_NAME = repoNameInput.value.trim();
    PROJECT_ID = projectIdInput.value.trim();
    await chrome.storage.local.set({
      githubToken: tokenInput.value,
      repoOwner: REPO_OWNER,
      repoName: REPO_NAME,
      projectId: PROJECT_ID
    });
    console.log('Settings saved');
  }, 300);
}

tokenInput.addEventListener('input', saveSettings);
repoOwnerInput.addEventListener('input', saveSettings);
repoNameInput.addEventListener('input', saveSettings);
projectIdInput.addEventListener('input', saveSettings);

// Generate title preview
bodyInput.addEventListener('input', () => {
  const title = generateTitle(bodyInput.value);
  if (title) {
    generatedTitleDiv.textContent = `📋 Title: "${title}"`;
  } else {
    generatedTitleDiv.textContent = '';
  }
});

// Generate title from body
function generateTitle(body) {
  if (!body.trim()) return '';
  
  // Remove quotes at start
  const text = body.replace(/^>\s*/, '').trim();
  
  // Get first line or first sentence
  let title = text.split('\n')[0];
  
  // If first line is too long, try first sentence
  if (title.length > 80) {
    const sentenceMatch = text.match(/^[^.!?]+[.!?]/);
    if (sentenceMatch && sentenceMatch[0].length <= 80) {
      title = sentenceMatch[0];
    }
  }
  
  // Truncate if still too long
  if (title.length > 80) {
    title = `${title.substring(0, 77)}...`;
  }
  
  // Clean up
  title = title.replace(/^[-*#\s]+/, '').trim();
  
  return title;
}

// Submit issue
submitBtn.addEventListener('click', async () => {
  const body = bodyInput.value.trim();
  const token = tokenInput.value.trim();
  
  if (!body) {
    showStatus('Please enter an issue description', 'error');
    return;
  }
  
  if (!token) {
    showStatus('Please add your GitHub token in Settings', 'error');
    settingsDiv.classList.add('visible');
    settingsToggle.textContent = '⚙️ Hide Settings';
    return;
  }
  
  if (!REPO_OWNER || !REPO_NAME) {
    showStatus('Please configure repository owner and name in Settings', 'error');
    settingsDiv.classList.add('visible');
    settingsToggle.textContent = '⚙️ Hide Settings';
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';
  
  try {
    const title = generateTitle(body);
    const issueType = document.querySelector('input[name="issueType"]:checked').value;
    
    // Build issue body with context
    let issueBody = body;
    
    // Upload and add screenshot if present
    if (screenshotDataUrl) {
      submitBtn.textContent = 'Uploading screenshot...';
      const imageUrl = await uploadImageToGitHub(screenshotDataUrl, token);
      issueBody += `\n\n### Screenshot\n![Screenshot](${imageUrl})`;
    }
    
    if (includeContext.checked && currentTab) {
      issueBody += '\n\n---\n\n';
      issueBody += `**Context:**\n`;
      issueBody += `- Page: ${currentTab.title}\n`;
      issueBody += `- URL: ${currentTab.url}\n`;
    }
    
    submitBtn.textContent = 'Creating issue...';
    
    // Create the issue with issue type
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        body: issueBody,
        type: issueType // GitHub issue type (Bug/Enhancement)
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create issue');
    }
    
    const issue = await response.json();
    
    // Add to project with Type field (if project ID is configured)
    if (PROJECT_ID) {
      submitBtn.textContent = 'Adding to project...';
      try {
        await addIssueToProject(issue.node_id, issueType, token);
      } catch (projectError) {
        console.error('Failed to add to project:', projectError);
        showStatus(`Issue <a href="${issue.html_url}" target="_blank">#${issue.number}</a> created, but failed to add to project: ${projectError.message}`, 'success');
        bodyInput.value = '';
        generatedTitleDiv.textContent = '';
        screenshotDataUrl = null;
        screenshotImg.src = '';
        screenshotPreview.classList.remove('visible');
        clearDraft();
        return;
      }
    }
    
    showStatus(`Issue <a href="${issue.html_url}" target="_blank">#${issue.number}</a> created successfully!`, 'success');
    bodyInput.value = '';
    generatedTitleDiv.textContent = '';
    screenshotDataUrl = null;
    screenshotImg.src = '';
    screenshotPreview.classList.remove('visible');
    clearDraft();
    
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Issue';
  }
});

function showStatus(message, type) {
  statusDiv.innerHTML = message;
  statusDiv.className = `status ${type}`;
}

// Screenshot functionality
captureTabBtn.addEventListener('click', async () => {
  try {
    captureTabBtn.disabled = true;
    captureTabBtn.textContent = 'Capturing...';
    
    // Capture visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    setScreenshot(dataUrl);
  } catch (error) {
    showStatus(`Screenshot failed: ${error.message}`, 'error');
  } finally {
    captureTabBtn.disabled = false;
    captureTabBtn.textContent = '📷 Capture Tab';
  }
});

selectRegionBtn.addEventListener('click', async () => {
  try {
    selectRegionBtn.disabled = true;
    selectRegionBtn.textContent = 'Capturing...';
    
    // Capture full tab first
    const fullScreenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    
    // Show crop UI in popup
    showCropUI(fullScreenshot);
  } catch (error) {
    showStatus(`Region select failed: ${error.message}`, 'error');
  } finally {
    selectRegionBtn.disabled = false;
    selectRegionBtn.textContent = '✂️ Select Region';
  }
});

// Crop UI in popup
function showCropUI(screenshotDataUrl) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'crop-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.9);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    padding: 10px;
  `;
  
  // Instructions
  const instructions = document.createElement('div');
  instructions.style.cssText = 'color: white; font-size: 12px; margin-bottom: 8px; text-align: center;';
  instructions.textContent = 'Click and drag to select region. Release to crop.';
  modal.appendChild(instructions);
  
  // Canvas container
  const container = document.createElement('div');
  container.style.cssText = 'flex: 1; overflow: auto; position: relative;';
  
  // Canvas for the image
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'cursor: crosshair; max-width: 100%;';
  container.appendChild(canvas);
  
  // Selection overlay
  const selection = document.createElement('div');
  selection.style.cssText = `
    position: absolute;
    border: 2px dashed #0969da;
    background: rgba(9, 105, 218, 0.2);
    pointer-events: none;
    display: none;
  `;
  container.appendChild(selection);
  
  modal.appendChild(container);
  
  // Buttons
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display: flex; gap: 8px; margin-top: 8px;';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'flex: 1; padding: 8px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;';
  cancelBtn.onclick = () => modal.remove();
  
  const useFullBtn = document.createElement('button');
  useFullBtn.textContent = 'Use Full Screenshot';
  useFullBtn.style.cssText = 'flex: 1; padding: 8px; background: #0969da; color: white; border: none; border-radius: 4px; cursor: pointer;';
  useFullBtn.onclick = () => {
    setScreenshot(screenshotDataUrl);
    modal.remove();
  };
  
  buttons.appendChild(cancelBtn);
  buttons.appendChild(useFullBtn);
  modal.appendChild(buttons);
  
  document.body.appendChild(modal);
  
  // Load image and set up canvas
  const img = new Image();
  img.onload = () => {
    // Scale to fit popup
    const maxWidth = 380;
    const scale = Math.min(1, maxWidth / img.width);
    
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Selection handling
    let startX, startY, isSelecting = false;
    const _rect = canvas.getBoundingClientRect();
    
    canvas.onmousedown = (e) => {
      const canvasRect = canvas.getBoundingClientRect();
      startX = e.clientX - canvasRect.left;
      startY = e.clientY - canvasRect.top;
      isSelecting = true;
      selection.style.display = 'block';
      selection.style.left = `${startX}px`;
      selection.style.top = `${startY}px`;
      selection.style.width = '0';
      selection.style.height = '0';
    };
    
    canvas.onmousemove = (e) => {
      if (!isSelecting) return;
      const canvasRect = canvas.getBoundingClientRect();
      const currentX = e.clientX - canvasRect.left;
      const currentY = e.clientY - canvasRect.top;
      
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      selection.style.left = `${left}px`;
      selection.style.top = `${top}px`;
      selection.style.width = `${width}px`;
      selection.style.height = `${height}px`;
    };
    
    canvas.onmouseup = (e) => {
      if (!isSelecting) return;
      isSelecting = false;
      
      const canvasRect = canvas.getBoundingClientRect();
      const currentX = e.clientX - canvasRect.left;
      const currentY = e.clientY - canvasRect.top;
      
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      if (width < 10 || height < 10) {
        selection.style.display = 'none';
        return;
      }
      
      // Crop the original image at full resolution
      const cropCanvas = document.createElement('canvas');
      const origScale = img.width / canvas.width;
      
      cropCanvas.width = width * origScale;
      cropCanvas.height = height * origScale;
      
      const cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(
        img,
        left * origScale,
        top * origScale,
        width * origScale,
        height * origScale,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );
      
      const croppedDataUrl = cropCanvas.toDataURL('image/png');
      setScreenshot(croppedDataUrl);
      modal.remove();
    };
  };
  img.src = screenshotDataUrl;
}

removeScreenshotBtn.addEventListener('click', () => {
  screenshotDataUrl = null;
  screenshotImg.src = '';
  screenshotPreview.classList.remove('visible');
  chrome.storage.local.remove(['pendingScreenshot', 'draftScreenshot']);
});

function setScreenshot(dataUrl) {
  screenshotDataUrl = dataUrl;
  screenshotImg.src = dataUrl;
  screenshotPreview.classList.add('visible');
  saveDraft();
}

// Upload image to Imgur (free, anonymous upload)
async function uploadImageToGitHub(dataUrl, _token) {
  const base64 = dataUrl.split(',')[1];
  
  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      'Authorization': 'Client-ID 546c25a59c58ad7', // Anonymous upload client ID
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image: base64,
      type: 'base64',
      title: 'Slide Editor Issue Screenshot'
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.data?.error || 'Failed to upload screenshot');
  }
  
  const result = await response.json();
  return result.data.link;
}

// GraphQL helper
async function graphql(query, variables, token) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  
  const result = await response.json();
  console.log('GraphQL response:', result);
  if (result.errors) {
    const errorMsg = result.errors[0].message;
    // Check for scope/permission error
    if (errorMsg.includes('scopes') || errorMsg.includes('project')) {
      throw new Error('Token needs "project" scope. Update at: github.com/settings/tokens');
    }
    throw new Error(errorMsg);
  }
  return result.data;
}

// Add issue to project and set Type field
async function addIssueToProject(issueNodeId, issueType, token) {
  // Use the configured project ID
  const projectId = PROJECT_ID;
  
  if (!projectId) {
    // Skip project integration if no project ID configured
    return;
  }
  
  console.log('Adding to project:', projectId);
  
  // Add issue to project
  const addMutation = `
    mutation addToProject($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
        item {
          id
        }
      }
    }
  `;
  
  const addResult = await graphql(addMutation, {
    projectId: projectId,
    contentId: issueNodeId
  }, token);
  
  const itemId = addResult.addProjectV2ItemById?.item?.id;
  if (!itemId) {
    throw new Error('Failed to add issue to project');
  }
  
  console.log('Added to project, item ID:', itemId);
  
  // Get project fields to find the Type field
  const fieldsQuery = `
    query getFields($projectId: ID!) {
      node(id: $projectId) {
        ... on ProjectV2 {
          fields(first: 20) {
            nodes {
              ... on ProjectV2SingleSelectField {
                id
                name
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const fieldsData = await graphql(fieldsQuery, { projectId: projectId }, token);
  console.log('Project fields:', fieldsData.node?.fields?.nodes);
  
  const typeField = fieldsData.node?.fields?.nodes?.find(f => f.name === 'Issue type');
  
  if (!typeField) {
    throw new Error('Issue type field not found in project. Available fields logged to console.');
  }
  
  console.log('Type field:', typeField);
  
  // Map issueType to project field options (Bug stays Bug, Enhancement -> Feature)
  const projectType = issueType === 'Enhancement' ? 'Feature' : issueType;
  const typeOption = typeField.options?.find(o => o.name === projectType);
  if (!typeOption) {
    const availableOptions = typeField.options?.map(o => o.name).join(', ') || 'none';
    throw new Error(`Type option "${projectType}" not found. Available: ${availableOptions}`);
  }
  
  // Set the Type field value
  const updateMutation = `
    mutation setType($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) {
        projectV2Item {
          id
        }
      }
    }
  `;
  
  await graphql(updateMutation, {
    projectId: projectId,
    itemId: itemId,
    fieldId: typeField.id,
    optionId: typeOption.id
  }, token);
  
  console.log('Issue type field set successfully');
  
  // Set Status to Ready
  const statusField = fieldsData.node?.fields?.nodes?.find(f => f.name === 'Status');
  if (statusField) {
    const readyOption = statusField.options?.find(o => o.name === 'Ready');
    if (readyOption) {
      await graphql(updateMutation, {
        projectId: projectId,
        itemId: itemId,
        fieldId: statusField.id,
        optionId: readyOption.id
      }, token);
      console.log('Status field set to Ready');
    }
  }
}
