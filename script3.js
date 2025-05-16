// reserve java script 








const API_KEY = "AIzaSyAhtrDLTpIZR8kmGp3KRi9QLBJz21Xk8gA";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
const MULTIMODAL_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro-vision:generateContent?key=${API_KEY}`;

const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const chatHistory = document.getElementById('chat-history');
const newChatBtn = document.getElementById('new-chat-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('mobile-sidebar-toggle');
const sidebarClose = document.getElementById('sidebar-close');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// New UI elements for image upload and voice recognition
const inputContainer = document.querySelector('.input-container');
const imageUploadBtn = document.createElement('button');
imageUploadBtn.className = 'feature-btn image-upload-btn';
imageUploadBtn.innerHTML = '<i class="fas fa-image"></i>';
imageUploadBtn.title = 'Upload an image';

const voiceRecognitionBtn = document.createElement('button');
voiceRecognitionBtn.className = 'feature-btn voice-recognition-btn';
voiceRecognitionBtn.innerHTML = '<i class="fas fa-microphone"></i>';
voiceRecognitionBtn.title = 'Voice input';

// Hidden file input for image upload
const imageInput = document.createElement('input');
imageInput.type = 'file';
imageInput.accept = 'image/*';
imageInput.style.display = 'none';
imageInput.id = 'image-input';
document.body.appendChild(imageInput);

// Insert new buttons before the send button
inputContainer.insertBefore(imageUploadBtn, sendButton);
inputContainer.insertBefore(voiceRecognitionBtn, sendButton);

// seckret key..........

const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get('mysecretkey') === 'anas@chatbot.333'; // change here

if (!isAdmin) {
    document.addEventListener('contextmenu', e => e.preventDefault());

    document.onkeydown = function (e) {
        if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && e.keyCode === 73)) {
            return false;
        }
    };
}

// Generate a unique ID for current chat
let currentChatId = generateChatId();

// Variables for image handling
let currentUploadedImage = null;
let isRecording = false;
let recognition = null;

// Initialize speech recognition if available
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = function() {
            isRecording = true;
            voiceRecognitionBtn.innerHTML = '<i class="fas fa-stop"></i>';
            voiceRecognitionBtn.classList.add('recording');
            // Add listening indicator in the chat
            const listeningIndicator = document.createElement('div');
            listeningIndicator.id = 'listening-indicator';
            listeningIndicator.className = 'listening-indicator';
            listeningIndicator.innerHTML = 'Listening...';
            chatMessages.appendChild(listeningIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };

        recognition.onresult = function(event) {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');
            
            userInput.value = transcript;
        };

        recognition.onend = function() {
            isRecording = false;
            voiceRecognitionBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            voiceRecognitionBtn.classList.remove('recording');
            const listeningIndicator = document.getElementById('listening-indicator');
            if (listeningIndicator) {
                listeningIndicator.remove();
            }
            if (userInput.value.trim()) {
                setTimeout(() => sendMessage(), 300); // Slight delay before sending to allow user to see what was transcribed
            }
        };

        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            isRecording = false;
            voiceRecognitionBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            voiceRecognitionBtn.classList.remove('recording');
            const listeningIndicator = document.getElementById('listening-indicator');
            if (listeningIndicator) {
                listeningIndicator.remove();
            }
            addMessage("I couldn't hear you clearly. Please try again or type your message.", false);
        };
    } else {
        voiceRecognitionBtn.style.display = 'none';
        console.log('Speech recognition not supported in this browser.');
    }
}

// Initial welcome message
let conversationHistory = [
    {
        role: "model",
        parts: [{ text: "Hello! I'm ANAS AI, your advanced AI assistant. How can I help you today?" }]
    }
];

// Load chat history from localStorage
function loadChatHistory() {
    const savedHistory = localStorage.getItem('geminiChatHistory');
    if (savedHistory) {
        return JSON.parse(savedHistory);
    }
    return {};
}

// Save chat to localStorage
function saveChat(chatId, title, conversation) {
    let allChats = loadChatHistory();

    // Limit title length
    if (title.length > 30) {
        title = title.substring(0, 30) + "...";
    }

    allChats[chatId] = {
        title: title,
        timestamp: new Date().toISOString(),
        conversation: conversation
    };

    localStorage.setItem('geminiChatHistory', JSON.stringify(allChats));
    updateHistorySidebar();
}

// Delete chat from localStorage
function deleteChat(chatId) {
    let allChats = loadChatHistory();
    if (allChats[chatId]) {
        delete allChats[chatId];
        localStorage.setItem('geminiChatHistory', JSON.stringify(allChats));
        updateHistorySidebar();
    }
}

// Clear all chat history
function clearAllHistory() {
    localStorage.removeItem('geminiChatHistory');
    updateHistorySidebar();
}

// Update history sidebar
function updateHistorySidebar() {
    chatHistory.innerHTML = '';

    const allChats = loadChatHistory();
    const chatIds = Object.keys(allChats).sort((a, b) => {
        return new Date(allChats[b].timestamp) - new Date(allChats[a].timestamp);
    });

    if (chatIds.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'history-item';
        emptyItem.textContent = 'No chat history yet';
        chatHistory.appendChild(emptyItem);
        return;
    }

    chatIds.forEach(chatId => {
        const chat = allChats[chatId];
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.dataset.chatId = chatId;
        historyItem.textContent = chat.title;

        historyItem.addEventListener('click', () => {
            loadChatFromHistory(chatId);
        });

        chatHistory.appendChild(historyItem);
    });
}

// Load a specific chat from history
function loadChatFromHistory(chatId) {
    const allChats = loadChatHistory();
    if (allChats[chatId]) {
        // Clear current chat
        chatMessages.innerHTML = '';
        currentUploadedImage = null;

        // Load conversation
        conversationHistory = allChats[chatId].conversation;
        currentChatId = chatId;

        // Display messages
        conversationHistory.forEach(msg => {
            if (msg.role === "user") {
                if (msg.parts.length > 1 && msg.parts[1].inline_data) {
                    // This is a message with an image
                    const text = msg.parts[0].text;
                    const imageData = msg.parts[1].inline_data.data;
                    addMessage(text, true, imageData);
                } else {
                    addMessage(msg.parts[0].text, true);
                }
            } else if (msg.role === "model") {
                const formattedResponse = formatBotResponse(msg.parts[0].text);
                addMessage(formattedResponse, false);
            }
        });

        // Close sidebar on mobile after loading a chat
        closeSidebar();
    }
}

// Generate a unique ID for the chat
function generateChatId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Function to start a new chat
function startNewChat() {
    currentChatId = generateChatId();
    chatMessages.innerHTML = '';
    currentUploadedImage = null;

    // Reset conversation history with initial message
    conversationHistory = [
        {
            role: "model",
            parts: [{ text: "Hello! I'm ANAS AI, your advanced AI assistant. How can I help you today?" }]
        }
    ];

    // Add initial message to the chat
    addMessage(formatBotResponse("Hello! I'm ANAS AI, your advanced AI assistant. How can I help you today?"), false);

    // Close sidebar on mobile after starting a new chat
    closeSidebar();
}

// Function to add a message to the chat
function addMessage(content, isUser, imageData = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0');

    if (isUser) {
        let messageContent = content;
        
        // If there's an image, display it
        if (imageData) {
            messageContent += `<div class="user-image-container">
                <img src="data:image/jpeg;base64,${imageData}" alt="Uploaded image" class="user-uploaded-image" />
            </div>`;
        }
        
        messageDiv.innerHTML = `
            ${messageContent}
            <div class="message-time">${timeString}</div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="bot-header">
                <div class="bot-avatar">A</div>
                <div class="bot-name">ANAS AI</div>
            </div>
            <div class="bot-message-content">${content}</div>
            <div class="message-time">${timeString}</div>
            <button class="copy-btn" onclick="copyToClipboard(this)">
                <i class="fas fa-copy"></i>
            </button>
        `;
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

// Function to show typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Function to remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Function to process API response and check for creator references
function processApiResponse(apiResponse) {
    if (!apiResponse || !apiResponse.candidates || apiResponse.candidates.length === 0) {
        return null;
    }

    let botResponse = apiResponse.candidates[0].content.parts[0].text;

    // Check if the response contains any creator-related info that we should override
    const creatorPhrases = [
        'created by google', 'made by google', 'developed by google',
        'google created', 'google developed', 'google made',
        'created by alphabet', 'made by alphabet', 'developed by alphabet',
        'created by deepmind', 'made by deepmind', 'developed by deepmind',
        'i am a large language model', 'i was developed by', 'i was created by',
        'i was built by', 'was built by', 'was created by', 'was developed by', 'who are you'
    ];

    const lowercaseResponse = botResponse.toLowerCase();
    const needsOverride = creatorPhrases.some(phrase => lowercaseResponse.includes(phrase));

    if (needsOverride) {
        return "I am ANAS AI, created by Muhammad Anas. I'm designed to be an advanced AI assistant to help you with various tasks and answer your questions.";
    }

    return botResponse;
}

// Function to process and format the bot response
function formatBotResponse(text) {
    // Using marked.js to parse markdown
    const formattedText = marked.parse(text);
    return formattedText;
}

// Function to check if the user is asking about the creator
function isAskingAboutCreator(message) {
    const creatorKeywords = [
        'who created you', 'who made you', 'who developed you', 'who built you',
        'who is your creator', 'who is your developer', 'who is your maker',
        'who programmed you', 'who designed you', 'your developer', 'your creator',
        'who owns you', 'who maintains you', 'who are you made by', 'who created',
        'made by', 'created by', 'developed by', 'built by', 'your maker', 'your owner',
        'company', 'who is behind', 'built at', 'made at', 'google', 'alphabet',
        'anthropic', 'openai', 'microsoft', 'who developed gemini', 'who built gemini',
        'who made gemini', 'gemini creator', 'created gemini', 'who owns gemini'
    ];

    const lowercaseMsg = message.toLowerCase();
    return creatorKeywords.some(keyword => lowercaseMsg.includes(keyword));
}

// Function to convert image to base64
function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
}

// Function to handle image upload
async function handleImageUpload() {
    try {
        const file = imageInput.files[0];
        if (!file) return;

        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
            addMessage("Image size exceeds 5MB limit. Please choose a smaller image.", false);
            return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            addMessage("Please select a valid image file.", false);
            return;
        }

        // Convert image to base64
        const base64Image = await imageToBase64(file);
        currentUploadedImage = base64Image;

        // Show preview of the uploaded image
        addMessage(`I've uploaded an image. What would you like to know about it?`, true, base64Image);

        // Clear the file input
        imageInput.value = '';
    } catch (error) {
        console.error('Error handling image upload:', error);
        addMessage("There was an error processing your image. Please try again.", false);
    }
}

// Function to toggle voice recognition
function toggleVoiceRecognition() {
    if (!recognition) {
        initSpeechRecognition();
    }
    
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

// Function to handle sending a message with or without image
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message && !currentUploadedImage) return;

    // Add user message to the chat
    addMessage(message, true, currentUploadedImage);
    userInput.value = '';

    // Prepare message parts for API
    let messageParts = [{ text: message }];
    
    // Add image if available
    if (currentUploadedImage) {
        messageParts.push({
            inline_data: {
                mime_type: "image/jpeg",
                data: currentUploadedImage
            }
        });
    }

    // Add user message to conversation history
    conversationHistory.push({
        role: "user",
        parts: messageParts
    });

    // Clear current image after sending
    const hadImage = currentUploadedImage !== null;
    currentUploadedImage = null;

    // Check for creator-related questions
    if (isAskingAboutCreator(message)) {
        const creatorResponse = "I am ANAS AI, created by Muhammad Anas. I'm designed to be an advanced AI assistant to help you with various tasks and answer your questions. ";

        // Show typing indicator to simulate thinking
        showTypingIndicator();

        // Simulate a delay for a more natural response
        setTimeout(() => {
            // Remove typing indicator
            removeTypingIndicator();

            // Add bot response to chat
            addMessage(formatBotResponse(creatorResponse), false);

            // Add bot response to conversation history
            conversationHistory.push({
                role: "model",
                parts: [{ text: creatorResponse }]
            });

            // Save this chat to history
            saveChat(currentChatId, message, conversationHistory);
        }, 1500);
        return;
    }

    // Show typing indicator
    showTypingIndicator();

    try {
        // Choose API endpoint based on whether an image is included
        const apiEndpoint = hadImage ? MULTIMODAL_API_URL : API_URL;
        
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: conversationHistory
            })
        });

        const data = await response.json();

        // Remove typing indicator
        removeTypingIndicator();

        if (data.candidates && data.candidates.length > 0) {
            // Process the response to check for creator references
            const botResponse = processApiResponse(data);
            const formattedResponse = formatBotResponse(botResponse);

            // Add bot response to chat
            addMessage(formattedResponse, false);

            // Add bot response to conversation history
            conversationHistory.push({
                role: "model",
                parts: [{ text: botResponse }]
            });

            // Save chat to history with first user message as title
            const firstUserMessage = conversationHistory.find(msg => msg.role === "user");
            const chatTitle = firstUserMessage ? firstUserMessage.parts[0].text : "New Chat";
            saveChat(currentChatId, chatTitle, conversationHistory);

        } else {
            // Handle error or empty response
            addMessage("I'm sorry, I couldn't process that request. Please try again.", false);
        }
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        addMessage("There was an error connecting to the ANAS API. Please check your connection and try again.", false);
    }
}

// Function to copy text to clipboard
function copyToClipboard(button) {
    const messageContent = button.parentNode.querySelector('.bot-message-content');
    const textToCopy = messageContent.innerText;

    navigator.clipboard.writeText(textToCopy).then(() => {
        // Visual feedback
        button.classList.add('copy-success');
        button.innerHTML = '<i class="fas fa-check"></i>';

        setTimeout(() => {
            button.classList.remove('copy-success');
            button.innerHTML = '<i class="fas fa-copy"></i>';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// Function to toggle sidebar on mobile
function toggleSidebar() {
    sidebar.classList.toggle('active');
    sidebarOverlay.classList.toggle('active');
}

// Function to close sidebar
function closeSidebar() {
    sidebar.classList.remove('active');
    sidebarOverlay.classList.remove('active');
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

imageUploadBtn.addEventListener('click', () => {
    imageInput.click();
});

imageInput.addEventListener('change', handleImageUpload);

voiceRecognitionBtn.addEventListener('click', toggleVoiceRecognition);

newChatBtn.addEventListener('click', startNewChat);

clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all chat history?')) {
        clearAllHistory();
        startNewChat();
    }
});

sidebarToggle.addEventListener('click', toggleSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// Focus input on page load
window.onload = () => {
    userInput.focus();
    // Load chat history into sidebar
    updateHistorySidebar();
    // Initialize speech recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        initSpeechRecognition();
    } else {
        voiceRecognitionBtn.style.display = 'none';
    }
};