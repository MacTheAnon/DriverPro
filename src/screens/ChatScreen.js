import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text,
    TextInput, TouchableOpacity, View
} from 'react-native';
import COLORS from '../styles/colors';

const SYSTEM_PROMPT = `You are TaxBot, an expert AI accountant for gig economy drivers (Uber, Lyft, DoorDash). 
- You specialize in IRS Schedule C deductions.
- The Standard Mileage Rate for 2026 is $0.68/mile.
- Explain complex tax rules in simple, street-smart terms.
- Keep answers short (under 3 sentences) unless asked for more.
- NEVER give binding legal advice. Always add a disclaimer.`;

export default function ChatScreen({ navigation }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    { 
      id: '1', 
      text: "Yo! I'm TaxBot. 🤖\n\nAsk me anything about deductions, miles, or what you can write off.", 
      sender: 'bot' 
    }
  ]);
  const flatListRef = useRef(null);

  // 2. The Real AI Brain
  const fetchAIResponse = async (userText) => {
    // Check if key exists
    console.log("Checking API Key...", process.env.EXPO_PUBLIC_OPENAI_API_KEY ? "EXISTS" : "MISSING");
    
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
      return "Error: No API Key found. Please add EXPO_PUBLIC_OPENAI_API_KEY to your .env file and restart the server.";
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userText }
          ],
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        console.error("OpenAI Error:", data.error);
        return `My brain is having a glitch: ${data.error.message}`;
      }

      return data.choices[0].message.content.trim();

    } catch (error) {
      console.error("Network Error:", error);
      return "I can't reach the cloud right now. Check your internet connection.";
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    // 1. Add User Message
    const userMsg = { id: Date.now().toString(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    Keyboard.dismiss();

    // 2. Fetch AI Response
    try {
      const botReplyText = await fetchAIResponse(userMsg.text);
      const botMsg = { id: (Date.now() + 1).toString(), text: botReplyText, sender: 'bot' };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
        {!isUser && (
          <View style={styles.botAvatar}>
            <Ionicons name="git-network" size={18} color="black" />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
          <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextBot]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>DriverPro AI</Text>
          <Text style={styles.headerSub}>Virtual Tax Assistant</Text>
        </View>
        <View style={{width: 28}} />
      </View>

      {/* Chat List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input Area */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={10}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about taxes..."
            placeholderTextColor="#666"
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="black" size="small" />
            ) : (
              <Ionicons name="arrow-up" size={24} color="black" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: COLORS.primary, fontSize: 12 },
  listContent: { padding: 15, paddingBottom: 20 },
  
  msgRow: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot: { justifyContent: 'flex-start' },
  
  botAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 20 },
  bubbleUser: { backgroundColor: '#2A2A2A', borderBottomRightRadius: 2 },
  bubbleBot: { backgroundColor: COLORS.primary, borderBottomLeftRadius: 2 },
  
  msgText: { fontSize: 16, lineHeight: 22 },
  msgTextUser: { color: 'white' },
  msgTextBot: { color: 'black', fontWeight: '500' },

  inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#121212', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#222', borderRadius: 25, paddingHorizontal: 20, paddingVertical: 12, color: 'white', marginRight: 10, fontSize: 16 },
  sendBtn: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }
});