/**
 * CoachChat - Conversational interface for workout modifications
 * Provides short suggestions and expert coordination for re-planning
 */
class CoachChat {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.expertCoordinator = window.ExpertCoordinator;
        this.overrideBar = window.OverrideBar;
        this.authManager = window.AuthManager;
        this.storageManager = window.StorageManager;

        this.chatHistory = [];
        this.conversationContext = []; // Last 3 exchanges (user + coach pairs)
        this.isOpen = false;

        this.STORAGE_KEY = 'ignitefitness_coach_chat_context';
        this.MAX_CONTEXT_EXCHANGES = 3; // Store last 3 exchanges

        this.initialize();
    }

    /**
     * Initialize coach chat
     */
    initialize() {
        this.createChatUI();
        this.loadConversationContext();
    }

    /**
     * Load conversation context from localStorage
     */
    loadConversationContext() {
        try {
            const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
            if (!userId) {return;}

            const storageKey = `${this.STORAGE_KEY}_${userId}`;
            const stored = localStorage.getItem(storageKey);

            if (stored) {
                const context = JSON.parse(stored);
                // Validate and load context
                if (Array.isArray(context) && context.length > 0) {
                    this.conversationContext = context.slice(-this.MAX_CONTEXT_EXCHANGES);
                    this.logger.debug('Loaded conversation context:', this.conversationContext.length, 'exchanges');
                }
            }
        } catch (error) {
            this.logger.error('Failed to load conversation context:', error);
            this.conversationContext = [];
        }
    }

    /**
     * Save conversation context to localStorage
     */
    saveConversationContext() {
        try {
            const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
            if (!userId) {return;}

            const storageKey = `${this.STORAGE_KEY}_${userId}`;
            // Keep only last MAX_CONTEXT_EXCHANGES exchanges
            const contextToSave = this.conversationContext.slice(-this.MAX_CONTEXT_EXCHANGES);

            localStorage.setItem(storageKey, JSON.stringify(contextToSave));
            this.logger.debug('Saved conversation context:', contextToSave.length, 'exchanges');
        } catch (error) {
            this.logger.error('Failed to save conversation context:', error);
        }
    }

    /**
     * Add exchange to conversation context
     * @param {string} userMessage - User message
     * @param {string} coachResponse - Coach response
     */
    addConversationExchange(userMessage, coachResponse) {
        const exchange = {
            user: userMessage,
            coach: coachResponse,
            timestamp: new Date().toISOString()
        };

        this.conversationContext.push(exchange);

        // Keep only last MAX_CONTEXT_EXCHANGES
        if (this.conversationContext.length > this.MAX_CONTEXT_EXCHANGES) {
            this.conversationContext.shift(); // Remove oldest
        }

        // Save to localStorage
        this.saveConversationContext();
    }

    /**
     * Get conversation context for use in generating responses
     * @returns {Array} Last 3 exchanges
     */
    getConversationContext() {
        return this.conversationContext.map(exchange => ({
            user: exchange.user,
            coach: exchange.coach
        }));
    }

    /**
     * Clear conversation context
     */
    clearConversationContext() {
        this.conversationContext = [];
        try {
            const userId = this.authManager?.getCurrentUserId() || this.authManager?.getCurrentUsername();
            if (userId) {
                const storageKey = `${this.STORAGE_KEY}_${userId}`;
                localStorage.removeItem(storageKey);
            }
        } catch (error) {
            this.logger.error('Failed to clear conversation context:', error);
        }
        this.logger.debug('Conversation context cleared');
    }

    /**
     * Clear entire conversation (UI + context)
     */
    clearConversation() {
        // Clear UI messages
        const messagesDiv = document.getElementById('chat-messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
        }

        // Clear conversation context
        this.clearConversationContext();

        // Clear chat history
        this.chatHistory = [];

        // Show confirmation
        this.addMessage('coach', 'Conversation cleared. How can I help you?');
        window.LiveRegionManager?.announce('Conversation history cleared', 'polite');

        this.logger.debug('Conversation cleared');
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
                <div class="chat-header-actions">
                    <button class="chat-clear" onclick="window.CoachChat.clearConversation()" 
                            title="Clear conversation history" aria-label="Clear conversation history">🗑️</button>
                    <button class="chat-close" onclick="window.CoachChat.closeChat()" aria-label="Close chat">&times;</button>
                </div>
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

        // Load conversation context if not already loaded
        if (this.conversationContext.length === 0) {
            this.loadConversationContext();
        }

        // Show welcome message (context-aware)
        if (this.conversationContext.length > 0) {
            this.addMessage('coach', 'Welcome back! I remember our earlier conversation. How can I help you today?');
        } else {
            this.addMessage('coach', 'Hey! How can I help adjust your workout today?');
        }

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

        if (!message) {return;}

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
            typingDiv.innerHTML = '<div class="message-bubble"><span class="if-spinner" style="vertical-align: middle; margin-right: 8px;"></span>Coach is thinking…</div>';
            messagesDiv.appendChild(typingDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 500);

        // Get response with conversation context
        const response = await this.getCoachResponse(message);
        clearTimeout(typingTimer);
        if (typingDiv && typingDiv.parentNode) {typingDiv.parentNode.removeChild(typingDiv);}

        // Add coach response
        this.addMessage('coach', response.text);
        window.LiveRegionManager?.announce('Coach response ready', 'polite');

        // Store exchange in conversation context
        this.addConversationExchange(message, response.text);

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
        // Get conversation context for contextual responses
        const context = this.getConversationContext();
        const lowerMessage = message.toLowerCase();

        // Check for follow-up questions that reference previous conversation
        const isFollowUp = this.detectFollowUp(message, context);

        // Simple pattern matching for common requests
        if (lowerMessage.includes('tired') || lowerMessage.includes('less')) {
            // Check if this is a follow-up about a previous request
            if (isFollowUp && context.length > 0) {
                const lastExchange = context[context.length - 1];
                if (lastExchange.coach && lastExchange.coach.includes('intensity')) {
                    return {
                        text: "I've already reduced the intensity. Is this still too much? I can make it even lighter if needed.",
                        modifications: { intensityMultiplier: 0.60 } // Further reduction
                    };
                }
            }

            return {
                text: "No problem! Let's reduce intensity by 20%. Focus on form over load today.",
                modifications: { intensityMultiplier: 0.80 }
            };
        }

        if (lowerMessage.includes('difficult') || lowerMessage.includes('too hard')) {
            // Context-aware follow-up
            if (isFollowUp && context.length > 0) {
                const lastExchange = context[context.length - 1];
                if (lastExchange.coach && lastExchange.coach.includes('lighter')) {
                    return {
                        text: "I understand you're still struggling. Let's switch to bodyweight alternatives and drop the intensity even more. Safety first!",
                        modifications: { maxRPE: 5, bodyweightOnly: true, reduceLoad: true }
                    };
                }
            }

            return {
                text: 'Got it! Switching to lighter alternatives and reducing RPE target by 2.',
                modifications: { maxRPE: 6, reduceLoad: true }
            };
        }

        if (lowerMessage.includes('less time') || lowerMessage.includes('quick')) {
            // Context-aware: check if time was already reduced
            if (isFollowUp && context.length > 0) {
                const lastExchange = context[context.length - 1];
                if (lastExchange.coach && lastExchange.coach.includes('circuit')) {
                    return {
                        text: 'I already created a 20-minute version. Need it even shorter? I can create a 15-minute super-quick circuit!',
                        modifications: { removeFinisher: true, circuitOnly: true, targetDuration: 15 }
                    };
                }
            }

            return {
                text: 'Creating 20-minute circuit. Skipping finisher to save time!',
                modifications: { removeFinisher: true, circuitOnly: true }
            };
        }

        if (lowerMessage.includes('equipment')) {
            // Context-aware: check previous equipment discussions
            if (isFollowUp && context.length > 0) {
                const lastExchange = context[context.length - 1];
                if (lastExchange.user && lastExchange.user.includes('equipment')) {
                    return {
                        text: 'Based on our earlier discussion, here are more equipment alternatives. Which option works best for you?',
                        modifications: { suggestAlternatives: true, showAllAlternatives: true }
                    };
                }
            }

            return {
                text: 'Here are alternatives: dumbbells, cables, or bodyweight versions. Want me to swap?',
                modifications: { suggestAlternatives: true }
            };
        }

        if (lowerMessage.includes('hurt') || lowerMessage.includes('pain')) {
            // Context-aware: follow-up on injury discussions
            if (isFollowUp && context.length > 0) {
                const lastExchange = context[context.length - 1];
                if (lastExchange.coach && lastExchange.coach.includes('area hurts')) {
                    // User is providing more details about the pain
                    return {
                        text: "Thanks for the details. I'm updating your plan with safer alternatives for that area. We'll avoid any exercises that could aggravate it.",
                        modifications: { triggerInjuryCheck: true, updateAlternatives: true }
                    };
                }
            }

            return {
                text: 'Safety first. Which area hurts? I will suggest safer alternatives immediately.',
                modifications: { triggerInjuryCheck: true }
            };
        }

        // Handle follow-up questions (yes/no, more/less, etc.)
        if (isFollowUp && context.length > 0) {
            const lastExchange = context[context.length - 1];
            const lastCoachMessage = lastExchange.coach || '';
            const lastUserMessage = lastExchange.user || '';

            // Handle yes/no responses
            if (lowerMessage.includes('yes') || lowerMessage === 'y' || lowerMessage === 'yeah' || lowerMessage === 'sure') {
                if (lastCoachMessage.includes('swap') || lastCoachMessage.includes('alternatives')) {
                    return {
                        text: "Perfect! I'm updating your workout with those alternatives now.",
                        modifications: { applyAlternatives: true }
                    };
                }
                if (lastCoachMessage.includes('reduce') || lastCoachMessage.includes('lighter')) {
                    return {
                        text: 'Great! The adjustments are being applied. Your workout will be updated shortly.',
                        modifications: { applyModifications: true }
                    };
                }
            }

            if (lowerMessage.includes('no') || lowerMessage === 'n' || lowerMessage === 'nah' || lowerMessage === "don't") {
                if (lastCoachMessage.includes('swap') || lastCoachMessage.includes('alternatives')) {
                    return {
                        text: "No problem! We'll stick with your current plan. Is there anything else I can help with?",
                        modifications: null
                    };
                }
            }

            // Handle "what about X?" follow-ups
            if (lowerMessage.includes('what about') || lowerMessage.includes('how about')) {
                return {
                    text: 'Good question! Let me check that for you based on our earlier discussion.',
                    modifications: { contextualFollowUp: true }
                };
            }
        }

        // Default response with context awareness
        if (context.length > 0) {
            return {
                text: "I'm here to help! Are you following up on our earlier discussion, or is this something new?",
                modifications: null
            };
        }

        return {
            text: "I am here to help. You can say: 'less time', 'too hard', 'different equipment', or ask about specific exercises.",
            modifications: null
        };
    }

    /**
     * Detect if message is a follow-up to previous conversation
     * @param {string} message - Current message
     * @param {Array} context - Conversation context
     * @returns {boolean} Is follow-up
     */
    detectFollowUp(message, context) {
        if (context.length === 0) {return false;}

        const lowerMessage = message.toLowerCase();

        // Follow-up indicators
        const followUpIndicators = [
            'yes', 'no', 'yep', 'nope', 'yeah', 'nah',
            'more', 'less', 'that', 'this', 'it', 'they',
            'what about', 'how about', 'can you', 'could you',
            'also', 'and', 'still', 'again', 'too'
        ];

        // Check for short responses that are likely follow-ups
        const shortResponses = ['yes', 'no', 'y', 'n', 'yeah', 'sure', 'ok', 'okay'];
        if (shortResponses.includes(lowerMessage.trim())) {
            return true;
        }

        // Check for pronouns that reference previous conversation
        const pronouns = ['it', 'that', 'this', 'they', 'them'];
        const hasPronoun = pronouns.some(pronoun =>
            lowerMessage.includes(` ${pronoun} `) ||
            lowerMessage.startsWith(`${pronoun} `) ||
            lowerMessage.endsWith(` ${pronoun}`)
        );

        // Check for follow-up phrases
        const hasFollowUpPhrase = followUpIndicators.some(indicator =>
            lowerMessage.includes(indicator)
        );

        // Check if message references topics from previous exchanges
        const lastExchange = context[context.length - 1];
        if (lastExchange && lastExchange.coach) {
            const lastTopics = this.extractTopics(lastExchange.coach);
            const currentTopics = this.extractTopics(message);

            // If current message mentions topics from previous exchange, it's likely a follow-up
            const topicMatch = currentTopics.some(topic => lastTopics.includes(topic));
            if (topicMatch) {
                return true;
            }
        }

        return hasPronoun || hasFollowUpPhrase || message.trim().length < 20;
    }

    /**
     * Extract key topics from a message
     * @param {string} message - Message text
     * @returns {Array<string>} Topics
     */
    extractTopics(message) {
        const topics = [];
        const lowerMessage = message.toLowerCase();

        const topicKeywords = {
            'intensity': ['intensity', 'hard', 'easy', 'light', 'heavy'],
            'time': ['time', 'duration', 'quick', 'short', 'long'],
            'equipment': ['equipment', 'dumbbell', 'barbell', 'cable', 'machine'],
            'pain': ['pain', 'hurt', 'injured', 'sore'],
            'exercise': ['exercise', 'movement', 'lift', 'workout'],
            'volume': ['volume', 'sets', 'reps', 'amount']
        };

        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some(keyword => lowerMessage.includes(keyword))) {
                topics.push(topic);
            }
        }

        return topics;
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
