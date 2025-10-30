/**
 * CoachChat - Conversational interface for workout modifications
 * Provides short suggestions and expert coordination for re-planning
 */
class CoachChat {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.expertCoordinator = window.ExpertCoordinator;
        this.overrideBar = window.OverrideBar;
        
        this.chatHistory = [];
        this.isOpen = false;
        
        this.initialize();
    }

    /**
     * Initialize coach chat
     */
    initialize() {
        this.createChatUI();
    }

    /**
     * Create chat UI
     */
    createChatUI() {
        const chatContainer = document.createElement('div');
        chatContainer.id = 'coach-chat';
        chatContainer.className = 'coach-chat hidden';
        
        chatContainer.innerHTML = `
            <div class="chat-header">
                <h3>💬 Coach Chat</h3>
                <button class="chat-close" onclick="window.CoachChat.closeChat()">&times;</button>
            </div>
            <div class="chat-messages" id="chat-messages"></div>
            <div class="chat-input">
                <input type="text" id="chat-input-field" placeholder="Ask coach anything...">
                <button id="chat-send" onclick="window.CoachChat.sendMessage()">Send</button>
            </div>
            <div class="quick-suggestions">
                ${this.getQuickSuggestions().map(sug => `
                    <button class="quick-suggestion" data-suggestion="${sug}">${sug}</button>
                `).join('')}
            </div>
        `;
        
        document.body.appendChild(chatContainer);
        
        // Setup input handling
        const input = document.getElementById('chat-input-field');
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    /**
     * Open chat
     */
    openChat() {
        const chat = document.getElementById('coach-chat');
        chat.classList.remove('hidden');
        this.isOpen = true;
        
        // Show welcome message
        this.addMessage('coach', 'Hey! How can I help adjust your workout today?');
        
        // Focus input
        const input = document.getElementById('chat-input-field');
        input?.focus();
    }

    /**
     * Close chat
     */
    closeChat() {
        const chat = document.getElementById('coach-chat');
        chat.classList.add('hidden');
        this.isOpen = false;
    }

    /**
     * Send message
     */
    async sendMessage() {
        const input = document.getElementById('chat-input-field');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message
        this.addMessage('user', message);
        
        // Clear input
        input.value = '';
        
        // Show delayed typing indicator (>500ms)
        let typingDiv = null;
        const typingTimer = setTimeout(() => {
            const messagesDiv = document.getElementById('chat-messages');
            typingDiv = document.createElement('div');
            typingDiv.className = 'chat-message coach typing';
            typingDiv.innerHTML = `<div class="message-bubble"><span class="if-spinner" style="vertical-align: middle; margin-right: 8px;"></span>Coach is thinking…</div>`;
            messagesDiv.appendChild(typingDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 500);

        // Get response
        const response = await this.getCoachResponse(message);
        clearTimeout(typingTimer);
        if (typingDiv && typingDiv.parentNode) typingDiv.parentNode.removeChild(typingDiv);
        
        // Add coach response
        this.addMessage('coach', response.text);
        
        // Apply any modifications
        if (response.modifications) {
            this.applyModifications(response.modifications);
        }
    }

    /**
     * Add message to chat
     * @param {string} sender - 'user' or 'coach'
     * @param {string} text - Message text
     */
    addMessage(sender, text) {
        const messagesDiv = document.getElementById('chat-messages');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${text}
            </div>
        `;
        
        messagesDiv.appendChild(messageDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        // Save to history
        this.chatHistory.push({ sender, text, timestamp: new Date() });
    }

    /**
     * Get coach response
     * @param {string} message - User message
     * @returns {Promise<Object>} Coach response
     */
    async getCoachResponse(message) {
        // Simple pattern matching for common requests
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('tired') || lowerMessage.includes('less')) {
            return {
                text: "No problem! Let's reduce intensity by 20%. Focus on form over load today.",
                modifications: { intensityMultiplier: 0.80 }
            };
        }
        
        if (lowerMessage.includes('difficult') || lowerMessage.includes('too hard')) {
            return {
                text: "Got it! Switching to lighter alternatives and reducing RPE target by 2.",
                modifications: { maxRPE: 6, reduceLoad: true }
            };
        }
        
        if (lowerMessage.includes('less time') || lowerMessage.includes('quick')) {
            return {
                text: "Creating 20-minute circuit. Skipping finisher to save time!",
                modifications: { removeFinisher: true, circuitOnly: true }
            };
        }
        
        if (lowerMessage.includes('equipment')) {
            return {
                text: "Here are alternatives: dumbbells, cables, or bodyweight versions. Want me to swap?",
                modifications: { suggestAlternatives: true }
            };
        }
        
        if (lowerMessage.includes('hurt') || lowerMessage.includes('pain')) {
            return {
                text: "Safety first. Which area hurts? I will suggest safer alternatives immediately.",
                modifications: { triggerInjuryCheck: true }
            };
        }
        
        // Default response
        return {
            text: "I am here to help. You can say: 'less time', 'too hard', 'different equipment', or ask about specific exercises.",
            modifications: null
        };
    }

    /**
     * Apply modifications
     * @param {Object} modifications - Modifications to apply
     */
    async applyModifications(modifications) {
        try {
            // Call ExpertCoordinator to re-plan with new constraints
            if (this.expertCoordinator) {
                const newPlan = await this.expertCoordinator.getSessionPlan({
                    user: this.getUserContext(),
                    modifications,
                    reason: 'User request via coach chat'
                });
                
                // Update current plan
                this.overrideBar.setCurrentPlan(newPlan);
                
                // Show notification
                this.showNotification('Plan updated! Check your new workout.');
            }
        } catch (error) {
            this.logger.error('Failed to apply modifications', error);
        }
    }

    /**
     * Get quick suggestions
     * @returns {Array<string>} Quick suggestions
     */
    getQuickSuggestions() {
        return [
            'Too hard',
            'Less time',
            'Equipment missing',
            'Something hurts',
            'Different workout'
        ];
    }

    /**
     * Handle quick suggestion click
     * @param {string} suggestion - Suggestion text
     */
    async handleQuickSuggestion(suggestion) {
        const input = document.getElementById('chat-input-field');
        input.value = suggestion;
        await this.sendMessage();
    }

    /**
     * Get user context
     * @returns {Object} User context
     */
    getUserContext() {
        // Would get from current user data
        return {
            sport: 'soccer',
            readiness: 7
        };
    }

    /**
     * Show notification
     * @param {string} message - Message
     */
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'coach-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.remove(), 3000);
    }
}

window.CoachChat = new CoachChat();
