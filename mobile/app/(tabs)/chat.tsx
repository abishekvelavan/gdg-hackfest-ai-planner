import React, { useState, useRef, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../../constants/Colors';
import { ChatMessage } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ChatBubble } from '../../components/ChatBubble';

const QUICK_PROMPTS = [
    '📋 Plan my day',
    '✅ Show todos',
    '🌤️ Check weather',
    '📧 Check email',
];

export default function ChatScreen() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const flatListRef = useRef<FlatList>(null);

    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading || !user) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: text.trim(),
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsLoading(true);

        try {
            const response = await api.chat(text.trim(), user.user_id, sessionId);
            setSessionId(response.session_id);

            const agentMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                text: response.response,
                timestamp: new Date().toISOString(),
            };

            setMessages(prev => [...prev, agentMsg]);
        } catch (error: any) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'agent',
                text: `⚠️ ${error.message || 'Something went wrong. Please try again.'}`,
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, sessionId]);

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        return <ChatBubble message={item} />;
    };

    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>Chat with your Day Planner</Text>
            <Text style={styles.emptySubtitle}>
                Ask me to plan your day, check weather, scan emails, or manage todos.
            </Text>
            <View style={styles.quickPromptsContainer}>
                {QUICK_PROMPTS.map((prompt) => (
                    <TouchableOpacity
                        key={prompt}
                        style={styles.quickPromptChip}
                        onPress={() => sendMessage(prompt)}
                    >
                        <Text style={styles.quickPromptText}>{prompt}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={90}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={[
                        styles.messagesList,
                        messages.length === 0 && styles.messagesListEmpty,
                    ]}
                    ListEmptyComponent={renderEmptyState}
                    onContentSizeChange={() => {
                        if (messages.length > 0) {
                            flatListRef.current?.scrollToEnd({ animated: true });
                        }
                    }}
                />

                {isLoading && (
                    <View style={styles.typingIndicator}>
                        <View style={styles.typingDots}>
                            <ActivityIndicator size="small" color={Colors.primary} />
                            <Text style={styles.typingText}>Agent is thinking...</Text>
                        </View>
                    </View>
                )}

                {messages.length > 0 && !isLoading && (
                    <View style={styles.quickPromptsRow}>
                        {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
                            <TouchableOpacity
                                key={prompt}
                                style={styles.quickPromptSmall}
                                onPress={() => sendMessage(prompt)}
                            >
                                <Text style={styles.quickPromptSmallText}>{prompt}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.textInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type a message..."
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        maxLength={2000}
                        editable={!isLoading}
                        onSubmitEditing={() => sendMessage(inputText)}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
                        onPress={() => sendMessage(inputText)}
                        disabled={!inputText.trim() || isLoading}
                    >
                        <Text style={styles.sendButtonText}>➤</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    messagesList: {
        padding: 16,
        paddingBottom: 8,
    },
    messagesListEmpty: {
        flex: 1,
        justifyContent: 'center',
    },
    typingIndicator: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    typingDots: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    typingText: {
        color: Colors.textSecondary,
        fontSize: 13,
        marginLeft: 8,
    },
    quickPromptsContainer: {
        marginTop: 24,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
    },
    quickPromptChip: {
        backgroundColor: Colors.surfaceLight,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    quickPromptText: {
        color: Colors.text,
        fontSize: 14,
    },
    quickPromptsRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 6,
    },
    quickPromptSmall: {
        backgroundColor: Colors.surface,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    quickPromptSmallText: {
        color: Colors.textSecondary,
        fontSize: 11,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    textInput: {
        flex: 1,
        backgroundColor: Colors.surfaceLight,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 15,
        color: Colors.text,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    sendButtonDisabled: {
        backgroundColor: Colors.surfaceElevated,
    },
    sendButtonText: {
        color: '#FFF',
        fontSize: 18,
    },
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});
