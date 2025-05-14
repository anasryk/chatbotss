
// DOM Elements
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistory = document.getElementById('chatHistory');
const chatContainer = document.getElementById('chatContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const examplePrompts = document.querySelectorAll('.example-prompt');




// API Configuration
const API_KEY = "AIzaSyBdFGnCCJvc6oh2vub3erMNnt_evwslTHs";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

// State Management
let chats = [];
let currentChatId = null;
let attachedFiles = [];

// Initialize the application
function init() {
    loadChatsFromLocalStorage();
    setupEventListeners();
    autoResizeTextarea();
}

// Load saved chats from localStorage
function loadChatsFromLocalStorage() {
    const savedChats = localStorage.getItem('geminiChats');
    if (savedChats) {
        chats = JSON.parse(savedChats);
        renderChatHistory();

        // If there was an active chat, load it
        const lastActiveChat = localStorage.getItem('lastActiveChat');
        if (lastActiveChat && chats.find(chat => chat.id === lastActiveChat)) {
            loadChat(lastActiveChat);
        }
    }
}

// Setup event listeners
function setupEventListeners() {
    // Toggle sidebar
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Create new chat
    newChatBtn.addEventListener('click', createNewChat);

    // Send message
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // File attachment
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);

    // Example prompts
    examplePrompts.forEach(prompt => {
        prompt.addEventListener('click', () => {
            const promptText = prompt.getAttribute('data-prompt');
            userInput.value = promptText;
            if (!currentChatId) {
                createNewChat();
            }
            userInput.focus();
        });
    });
}

// Auto-resize textarea
function autoResizeTextarea() {
    userInput.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        if (this.scrollHeight > 150) {
            this.style.overflowY = 'auto';
        } else {
            this.style.overflowY = 'hidden';
        }
    });
}

// Create a new chat
function createNewChat() {
    const newChat = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [],
        createdAt: new Date().toISOString()
    };

    chats.unshift(newChat);
    saveChatsToLocalStorage();
    renderChatHistory();
    loadChat(newChat.id);
}

// Load a specific chat
function loadChat(chatId) {
    currentChatId = chatId;
    localStorage.setItem('lastActiveChat', chatId);

    // Update active chat in history
    const historyItems = document.querySelectorAll('.history-item');
    historyItems.forEach(item => {
        if (item.getAttribute('data-id') === chatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Hide welcome screen and show messages
    welcomeScreen.style.display = 'none';
    renderChatMessages();

    // Close sidebar on mobile after selecting a chat
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
    }
}

// Delete a chat
function deleteChat(chatId, event) {
    event.stopPropagation();

    chats = chats.filter(chat => chat.id !== chatId);
    saveChatsToLocalStorage();
    renderChatHistory();

    if (currentChatId === chatId) {
        currentChatId = null;
        chatContainer.innerHTML = '';
        welcomeScreen.style.display = 'flex';
        localStorage.removeItem('lastActiveChat');
    }
}

// Send a message to the AI
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message && attachedFiles.length === 0) return;

    // Create a new chat if none exists
    if (!currentChatId) {
        createNewChat();
    }

    // Add user message to chat
    const userMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        attachments: [...attachedFiles]
    };

    const currentChat = chats.find(chat => chat.id === currentChatId);
    currentChat.messages.push(userMessage);

    // Update chat title if it's the first message
    if (currentChat.messages.length === 1) {
        currentChat.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
    }

    // Clear input and attachments
    userInput.value = '';
    userInput.style.height = 'auto';
    attachedFiles = [];

    // Render the updated messages
    renderChatMessages();
    saveChatsToLocalStorage();
    renderChatHistory();

    // Show typing indicator
    showTypingIndicator();

    try {
        // Call Gemini API
        const response = await callGeminiAPI(currentChat.messages);

        // Remove typing indicator
        removeTypingIndicator();

        // Add AI response to chat
        const aiMessage = {
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString()
        };

        currentChat.messages.push(aiMessage);
        renderChatMessages();
        saveChatsToLocalStorage();

    } catch (error) {
        console.error('Error calling Gemini API:', error);

        // Remove typing indicator
        removeTypingIndicator();

        // Add error message
        const errorMessage = {
            role: 'assistant',
            content: "I'm sorry, I encountered an error while processing your request. Please try again later.",
            timestamp: new Date().toISOString(),
            isError: true
        };

        currentChat.messages.push(errorMessage);
        renderChatMessages();
        saveChatsToLocalStorage();
    }
}

// Call the Gemini API
async function callGeminiAPI(messages) {
    // Format messages for the API
    const formattedMessages = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    const requestBody = {
        contents: formattedMessages,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048
        }
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`API call failed with status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

// Handle file uploads
function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
        const reader = new FileReader();

        reader.onload = function (e) {
            attachedFiles.push({
                name: file.name,
                type: file.type,
                size: file.size,
                data: e.target.result
            });
        };

        reader.readAsDataURL(file);
    }

    // Clear the input to allow selecting the same files again
    fileInput.value = '';
}

// Show typing indicator
function showTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message message-ai';
    typingIndicator.id = 'typingIndicator';
    typingIndicator.innerHTML = `
                <div class="avatar avatar-ai">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <div class="typing-indicator">
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                        <span class="typing-dot"></span>
                    </div>
                </div>
            `;

    chatContainer.appendChild(typingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Render chat history in sidebar
function renderChatHistory() {
    chatHistory.innerHTML = '';

    chats.forEach(chat => {
        const historyItem = document.createElement('div');
        historyItem.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
        historyItem.setAttribute('data-id', chat.id);
        historyItem.addEventListener('click', () => loadChat(chat.id));

        // Format date
        const date = new Date(chat.createdAt);
        const formattedDate = date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
        });

        historyItem.innerHTML = `
                    <div class="history-item-content">
                        <div class="history-item-title">${chat.title}</div>
                        <div class="history-item-preview">${formattedDate}</div>
                    </div>
                    <div class="delete-chat">
                        <i class="fas fa-trash"></i>
                    </div>
                `;

        // Add delete button event
        const deleteBtn = historyItem.querySelector('.delete-chat');
        deleteBtn.addEventListener('click', (e) => deleteChat(chat.id, e));

        chatHistory.appendChild(historyItem);
    });
}

// Render messages for the current chat
function renderChatMessages() {
    if (!currentChatId) return;

    const currentChat = chats.find(chat => chat.id === currentChatId);
    if (!currentChat) return;

    chatContainer.innerHTML = '';

    currentChat.messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${message.role === 'user' ? 'user' : 'ai'}`;

        const avatarIcon = message.role === 'user' ? 'fas fa-user' : 'fas fa-robot';

        let attachmentsHTML = '';
        if (message.attachments && message.attachments.length > 0) {
            attachmentsHTML = '<div class="attachments">';
            message.attachments.forEach(attachment => {
                attachmentsHTML += `
                            <div class="attachment">
                                <i class="fas fa-file"></i>
                                <span>${attachment.name}</span>
                            </div>
                        `;
            });
            attachmentsHTML += '</div>';
        }

        messageElement.innerHTML = `
                    <div class="avatar avatar-${message.role === 'user' ? 'user' : 'ai'}">
                        <i class="${avatarIcon}"></i>
                    </div>
                    <div class="message-content">
                        ${message.content}
                        ${attachmentsHTML}
                    </div>
                `;

        chatContainer.appendChild(messageElement);
    });

    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Save chats to localStorage
function saveChatsToLocalStorage() {
    localStorage.setItem('geminiChats', JSON.stringify(chats));
}




// Call the Gemini API
async function callGeminiAPI(messages) {
    // Get the latest user message
    const latestMessage = messages[messages.length - 1];
    
    // Check if we should override with a custom response (pre-processing)
    if (latestMessage.role === 'user') {
        const messageContent = latestMessage.content.toLowerCase();
        
        // Comprehensive list of identity-related questions
        const identityPatterns = [
            'who made you', 'who created you', 'who built you', 'who developed you',
            'who is your creator', 'who designed you', 'who programmed you',
            'who owns you', 'who trained you', 'who are you', 'what are you',
            'tell me about yourself', 'introduce yourself', 'what company made you',
            'what company created you', 'who made', 'creator', 'developer',
            'tell me about you', 'your name', 'what is your name', 'who trained',
            'made by', 'created by', 'developed by', 'trained by'
        ];
        
        // Check for identity questions and return a fixed response
        if (identityPatterns.some(pattern => messageContent.includes(pattern))) {
            return "I'm a chatbot made by Muhammad Anas. I was created by Muhammad Anas. I'm here to assist you with information and help with your questions.";
        }
    }

    // Proceed with normal API call for non-identity questions
    try {
        // Format messages for the API, without adding system instructions
        // (since they don't seem to be working as expected)
        const formattedMessages = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        const requestBody = {
            contents: formattedMessages,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048
            }
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const data = await response.json();
        let responseText = data.candidates[0].content.parts[0].text;
        
        // Post-processing: Check if the response contains problematic claims about being made by Google
        const googleClaims = [
            'made by google', 'created by google', 'developed by google', 
            'built by google', 'google made me', 'google created me',
            'trained by google', 'google trained me', 'i am gemini',
            'i was developed by google', 'i was built by google',
            'i was created by google'
        ];
        
        const lowerResponse = responseText.toLowerCase();
        
        // If the response contains any of these claims, replace it entirely
        if (googleClaims.some(claim => lowerResponse.includes(claim))) {
            return "I'm a chatbot made by Muhammad Anas . I'm here to assist you with information and help with your questions.";
        }
        
        return responseText;
    } catch (error) {
        console.error('Error calling ANAS AI API:', error);
        return "I'm sorry, I encountered an error while processing your request. Please try again later.";
    }
}



// Add these functions to your existing script.js file

// Function to ensure input container is properly sized on mobile
function fixMobileInputContainer() {
  const inputContainer = document.querySelector('.input-container');
  const inputBox = document.querySelector('.input-box');
  
  // Set initial styles for mobile
  function applyMobileStyles() {
    if (window.innerWidth <= 768) {
      inputContainer.style.position = 'sticky';
      inputContainer.style.bottom = '0';
      inputContainer.style.backgroundColor = 'var(--main-bg)';
      inputContainer.style.zIndex = '5';
      
      inputBox.style.maxWidth = '100%';
      userInput.style.width = '100%';
      userInput.style.minHeight = '24px';
    } else {
      // Reset for desktop
      inputContainer.style.position = 'relative';
      inputContainer.style.zIndex = 'auto';
      inputBox.style.maxWidth = '';
      userInput.style.width = '';
    }
  }
  
  // Apply on load and resize
  applyMobileStyles();
  window.addEventListener('resize', applyMobileStyles);
}

// Function to format the AI response with proper spacing and bullet points
function formatAIResponse(text) {
  if (!text) return text;
  
  // Add proper paragraph spacing
  let formattedText = text.replace(/\n\n/g, '<br><br>');
  
  // Handle single line breaks
  formattedText = formattedText.replace(/\n(?!\n)/g, '<br>');
  
  // Format bullet points with proper spacing
  formattedText = formattedText.replace(
    /(?:^|\n)[-*•][ \t]*(.*?)(?=\n[-*•]|\n\n|$)/g, 
    '<br>• $1'
  );
  
  // Format numbered lists
  formattedText = formattedText.replace(
    /(?:^|\n)(\d+)\.[ \t]*(.*?)(?=\n\d+\.|\n\n|$)/g,
    '<br>$1. $2'
  );
  
  // Remove leading break if it exists
  formattedText = formattedText.replace(/^<br>/, '');
  
  return formattedText;
}

// Override the existing callGeminiAPI function's return to format response
// Find this section in your existing callGeminiAPI function and modify only the return statement:
/*
const data = await response.json();
let responseText = data.candidates[0].content.parts[0].text;

// ... your existing Google claim checks ...

// Add formatting before returning
return formatAIResponse(responseText);
*/

// Add this to your init() function
function enhanceMobileExperience() {
  fixMobileInputContainer();
  
  // Enhance touch experience for buttons on mobile
  const allButtons = document.querySelectorAll('button');
  allButtons.forEach(button => {
    button.addEventListener('touchstart', function() {
      this.style.opacity = '0.7';
    });
    button.addEventListener('touchend', function() {
      this.style.opacity = '1';
    });
  });
}

// Call this in your init() function
// Modify your init() function to include:
function init() {
  loadChatsFromLocalStorage();
  setupEventListeners();
  autoResizeTextarea();
  enhanceMobileExperience(); // Add this line
}


// Initialize the app
init();
