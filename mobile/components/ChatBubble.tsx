import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Colors from '../constants/Colors';
import { ChatMessage } from '../types';

type ChatBubbleProps = {
    message: ChatMessage;
};

export function ChatBubble({ message }: ChatBubbleProps) {
    const isUser = message.role === 'user';

    return (
        <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
            {!isUser && (
                <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>🤖</Text>
                </View>
            )}
            <View
                style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.agentBubble,
                ]}
            >
                <Text style={[styles.messageText, isUser ? styles.userText : styles.agentText]}>
                    {message.text}
                </Text>
                <Text style={[styles.timestamp, isUser && styles.timestampUser]}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    messageRow: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-end',
    },
    messageRowUser: {
        justifyContent: 'flex-end',
    },
    avatarContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    avatarText: {
        fontSize: 16,
    },
    messageBubble: {
        maxWidth: '75%',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 18,
    },
    userBubble: {
        backgroundColor: Colors.userBubble,
        borderBottomRightRadius: 4,
    },
    agentBubble: {
        backgroundColor: Colors.agentBubble,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 21,
    },
    userText: {
        color: Colors.userBubbleText,
    },
    agentText: {
        color: Colors.agentBubbleText,
    },
    timestamp: {
        fontSize: 10,
        color: Colors.textMuted,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    timestampUser: {
        color: 'rgba(255,255,255,0.6)',
    },
});
