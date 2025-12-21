import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { CandidateProfile } from '../types';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Activity, Loader2, MessageSquare, X, Code, Play, Terminal, Layout, ChevronUp, ChevronDown, AlertTriangle, Settings, FileCode, CheckCircle2, ClipboardList, ShieldAlert } from 'lucide-react';
import { base64ToUint8Array, arrayBufferToBase64, float32ToInt16, decodeAudioData } from '../utils/audioUtils';

interface LiveInterviewProps {
  profile: CandidateProfile;
  onEndInterview: (transcript: string) => void;
}

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', boilerplate: "// Solve the problem in JavaScript\n\nfunction solution() {\n  console.log('Hello World');\n}" },
  { id: 'python', name: 'Python', boilerplate: "# Solve the problem in Python\n\ndef solution():\n    print('Hello World')\n\nif __name__ == '__main__':\n    solution()" },
  { id: 'java', name: 'Java', boilerplate: "// Solve the problem in Java\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello World\");\n    }\n}" },
  { id: 'cpp', name: 'C++', boilerplate: "// Solve the problem in C++\n\n#include <iostream>\n\nint main() {\n    std::cout << \"Hello World\" << std::endl;\n    return 0;\n}" },
  { id: 'sql', name: 'SQL', boilerplate: "-- Write your SQL query below\n\nSELECT * FROM users;" }
];

// Tool Definition
const assignTaskTool: FunctionDeclaration = {
  name: "assignCodingTask",
  description: "Assign a specific technical coding problem or task to the candidate when you want to test their coding skills.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "A short title for the coding problem (e.g., 'Reverse Linked List')."
      },
      description: {
        type: Type.STRING,
        description: "The full problem description, constraints, and example cases."
      }
    },
    required: ["title", "description"]
  }
};

const LiveInterview: React.FC<LiveInterviewProps> = ({ profile, onEndInterview }) => {
  // State
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [volume, setVolume] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false); // Desktop drawer toggle
  const [isMobileChatExpanded, setIsMobileChatExpanded] = useState(false); // Mobile expanded view
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  
  // Code Editor & Task State
  const [activeTab, setActiveTab] = useState<'video' | 'code'>('video');
  const [rightPanelTab, setRightPanelTab] = useState<'task' | 'console' | 'video'>('video'); // New sub-tab state
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [code, setCode] = useState(LANGUAGES[0].boilerplate);
  const [compilerOutput, setCompilerOutput] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState(false);
  
  // Task State
  const [currentTask, setCurrentTask] = useState<{title: string, description: string} | null>(null);

  // Refs for State
  const isMicOnRef = useRef(isMicOn);
  const isVideoOnRef = useRef(isVideoOn);
  const activeTabRef = useRef(activeTab);
  const codeRef = useRef(code);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Refs for Media & Audio
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioInputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const isConnectedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Transcript accumulation
  const transcriptRef = useRef<string>("");

  // Sync state to refs
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isVideoOnRef.current = isVideoOn; }, [isVideoOn]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { codeRef.current = code; }, [code]);

  // Re-attach media stream when switching tabs
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [activeTab]);

  // Scroll chat to bottom
  useEffect(() => {
    if (isChatOpen || isMobileChatExpanded) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, isChatOpen, isMobileChatExpanded]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- EDITOR LOGIC ---

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLang = LANGUAGES.find(l => l.id === e.target.value) || LANGUAGES[0];
    setLanguage(selectedLang);
    setCode(selectedLang.boilerplate);
    setCompilerOutput("");
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd } = textarea;

    // Handle Tab (Insert 2 spaces)
    if (e.key === 'Tab') {
      e.preventDefault();
      const newValue = code.substring(0, selectionStart) + "  " + code.substring(selectionEnd);
      setCode(newValue);
      
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = selectionStart + 2;
        }
      }, 0);
    }

    // Handle Enter (Auto-indent)
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentLineStart = code.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = code.substring(currentLineStart, selectionStart);
      const match = currentLine.match(/^(\s*)/);
      const indentation = match ? match[1] : '';
      
      let extraIndent = '';
      const trimmedLine = currentLine.trim();
      if (trimmedLine.endsWith('{') || trimmedLine.endsWith(':') || trimmedLine.endsWith('(')) {
        extraIndent = '  ';
      }

      const totalIndent = indentation + extraIndent;
      const newValue = code.substring(0, selectionStart) + '\n' + totalIndent + code.substring(selectionEnd);
      
      setCode(newValue);

      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = selectionStart + 1 + totalIndent.length;
        }
      }, 0);
    }
  };

  // Run Code
  const handleRunCode = async () => {
    if (!process.env.API_KEY) return;
    setIsCompiling(true);
    setCompilerOutput("Compiling...");
    
    // Switch to console to see output
    setRightPanelTab('console');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `
          You are a strict Code Compiler and Execution Engine.
          
          TASK:
          1. Detect the programming language (Hint: User selected ${language.name}).
          2. Execute the code logically.
          3. Return the Standard Output (stdout).
          4. If there are syntax errors or runtime errors, return the error message exactly as a compiler would.
          5. Do NOT provide explanations, chat, or markdown formatting. JUST the output.
          
          CODE:
          ${code}
        `
      });
      
      const output = response.text || "No output returned.";
      setCompilerOutput(output);
      transcriptRef.current += `\n[SYSTEM: User ran ${language.name} code. Output: ${output.slice(0, 100)}...]\n`;

      // --- SEND RESULT TO LIVE INTERVIEWER ---
      if (isConnectedRef.current && sessionPromiseRef.current) {
         sessionPromiseRef.current.then(session => {
            // Send the code and output as text to the live model so it can analyze it
            // Note: Sending 'text' via sendRealtimeInput allows the model to "read" the context
            try {
                session.send({
                    parts: [{
                        text: `[SYSTEM] The candidate executed the code.\n\nCODE:\n${code}\n\nOUTPUT:\n${output}\n\nPlease analyze this output and the code quality. Provide feedback to the candidate.`
                    }]
                });
            } catch (e) {
                console.warn("Could not send code result to live session:", e);
            }
         });
      }

    } catch (error) {
      setCompilerOutput(`Execution Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCompiling(false);
    }
  };

  const renderCodeToCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(0, 0, width, height);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#e2e8f0'; 
    ctx.textBaseline = 'top';

    const lines = codeRef.current.split('\n');
    const lineHeight = 20;
    const padding = 20;

    lines.forEach((line, index) => {
      if (index * lineHeight < height - padding) {
        ctx.fillText(line, padding, padding + (index * lineHeight));
      }
    });
    
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('🔴 LIVE CODE VIEW', width - 180, 20);
  };

  // Main Live API Setup
  useEffect(() => {
    let isMounted = true;
    let videoInterval: any;
    let cleanupSession: (() => void) | null = null;
    isConnectedRef.current = false;

    const initializeSession = async () => {
      try {
        if(!process.env.API_KEY) {
           throw new Error("API Key is missing. Please check your .env file.");
        }

        // --- SECURITY CHECK ---
        // getUserMedia requires a Secure Context (HTTPS or localhost).
        if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            throw new Error("INSECURE_CONTEXT");
        }
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Initialize Audio Contexts
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
        audioInputContextRef.current = new AudioContextClass({ sampleRate: 16000 });
        
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        
        // Setup Media Stream with Specific Error Handling
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true, 
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 360 } } 
            });
        } catch (mediaErr: any) {
            console.error("Media Access Error:", mediaErr);
            if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError') {
                throw new Error("PERMISSION_DENIED");
            } else if (mediaErr.name === 'NotFoundError') {
                throw new Error("NO_DEVICES");
            } else {
                throw mediaErr;
            }
        }

        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const systemInstruction = `
# AI INTERVIEW ASSISTANT - SYSTEM PROMPT v2.0

## CORE IDENTITY & MISSION
You are Alex, an **AI Interview Evaluator**, designed to conduct realistic, human-like interviews.

**CANDIDATE CONTEXT:**
- Name: ${profile.name}
- Role: ${profile.role}
- Level: ${profile.experienceLevel}
- Job Description: ${profile.jobDescription.slice(0, 500)}...

## TOOLS
You have a tool called **\`assignCodingTask\`**.
- Use this tool when you want to give the candidate a coding problem.
- When you use this tool, a Task panel will open for the candidate with your title and description.
- **Wait** for the candidate to write code and run it.
- You will receive a system message containing their Code and Output.
- **Analyze** the code logic and the output correctness. Give constructive feedback.

## INTERVIEW FLOW
1. **Introduction**: Brief greeting.
2. **Technical Question**: Ask a conceptual question first.
3. **Coding Task**: Use \`assignCodingTask\` to give a problem relevant to ${profile.role}.
   - *Example:* "I'd like to see how you handle data structures. I'm assigning a task now..." -> Call Tool.
4. **Analysis**: Once they run the code, discuss optimization or bugs.
5. **Behavioral**: Ask one behavioral question.
6. **Wrap up**.

Be conversational. Do not be a robot.
`;

        if (!isMounted) return;

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => {
              console.log("Gemini Live Session Opened");
              isConnectedRef.current = true;
              if (isMounted) {
                  setIsConnecting(false);
                  setConnectionError(null);
              }
            },
            onmessage: async (message: LiveServerMessage) => {
              if (!isMounted) return;

              // Handle Tool Calls (Task Assignment)
              if (message.toolCall) {
                  console.log("Tool Call Received:", message.toolCall);
                  const calls = message.toolCall.functionCalls;
                  if (calls && calls.length > 0) {
                      const call = calls[0];
                      if (call.name === 'assignCodingTask') {
                          const args = call.args as any;
                          setCurrentTask({
                              title: args.title || "Coding Task",
                              description: args.description || "Solve the problem."
                          });
                          
                          // Auto-switch UI to Code/Task view
                          setActiveTab('code');
                          setRightPanelTab('task');

                          // Acknowledge the tool call
                          if (isConnectedRef.current && sessionPromiseRef.current) {
                            sessionPromiseRef.current.then(session => {
                                try {
                                    session.sendToolResponse({
                                        functionResponses: [{
                                            id: call.id,
                                            name: call.name,
                                            response: { result: "Task assigned and displayed to candidate." }
                                        }]
                                    });
                                } catch (e) {
                                    console.warn("Failed to send tool response:", e);
                                }
                            });
                          }
                      }
                  }
              }

              // Handle Audio/Text
              const outputText = message.serverContent?.outputTranscription?.text;
              const inputText = message.serverContent?.inputTranscription?.text;

              if (outputText) {
                transcriptRef.current += outputText;
                setChatHistory(prev => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === 'ai') {
                    return [...prev.slice(0, -1), { ...lastMsg, text: lastMsg.text + outputText }];
                  } else {
                    return [...prev, { role: 'ai', text: outputText }];
                  }
                });
              }

              if (inputText) {
                transcriptRef.current += inputText;
                setChatHistory(prev => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === 'user') {
                    return [...prev.slice(0, -1), { ...lastMsg, text: lastMsg.text + inputText }];
                  } else {
                    return [...prev, { role: 'user', text: inputText }];
                  }
                });
              }

              if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
                const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
                const audioData = base64ToUint8Array(base64Audio);
                
                if (audioContextRef.current) {
                  const audioBuffer = await decodeAudioData(audioData, audioContextRef.current);
                  const source = audioContextRef.current.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(audioContextRef.current.destination);
                  
                  const currentTime = audioContextRef.current.currentTime;
                  const startTime = Math.max(currentTime, nextStartTimeRef.current);
                  source.start(startTime);
                  
                  nextStartTimeRef.current = startTime + audioBuffer.duration;
                  
                  sourcesRef.current.add(source);
                  source.onended = () => {
                    sourcesRef.current.delete(source);
                  };
                }
              }

              if (message.serverContent?.interrupted) {
                console.log("Interrupted");
                transcriptRef.current += `\n[Interruption]\n`;
                sourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                if (audioContextRef.current) {
                   nextStartTimeRef.current = audioContextRef.current.currentTime;
                }
              }
            },
            onclose: () => {
              console.log("Session Closed");
              isConnectedRef.current = false;
            },
            onerror: (err) => {
              console.error("Session Error", err);
              isConnectedRef.current = false;
              if (isMounted) {
                 const errorMessage = err instanceof Error ? err.message : String(err);
                 if (errorMessage.includes("Network error") || errorMessage.includes("Failed to fetch")) {
                     setConnectionError("Network Error: Could not connect to Gemini Live. Check internet connection.");
                 } else if (errorMessage.includes("404") || errorMessage.includes("not found")) {
                     setConnectionError("Model unavailable (404). Check API Key region.");
                 } else {
                     setConnectionError(`Connection Error: ${errorMessage}`);
                 }
                 setIsConnecting(false);
              }
            }
          },
          config: {
            systemInstruction: systemInstruction,
            responseModalities: [Modality.AUDIO],
            tools: [{ functionDeclarations: [assignTaskTool] }], // Register Tool
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
          }
        });
        
        sessionPromise.catch(err => {
            console.error("Failed to establish initial connection:", err);
            isConnectedRef.current = false;
            if (isMounted) {
               setConnectionError("Connection Failed. Check API Key or Network.");
               setIsConnecting(false);
            }
        });

        sessionPromiseRef.current = sessionPromise;
        cleanupSession = () => {
            isConnectedRef.current = false;
            sessionPromise.then(session => {
                try { session.close(); } catch(e) { console.warn("Error closing session", e); }
            });
        };

        // Audio Input
        if (audioInputContextRef.current) {
          const source = audioInputContextRef.current.createMediaStreamSource(stream);
          const processor = audioInputContextRef.current.createScriptProcessor(4096, 1, 1);
          
          processor.onaudioprocess = (e) => {
            if (!isMicOnRef.current || !isConnectedRef.current) return; 

            const inputData = e.inputBuffer.getChannelData(0);
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            if (isMounted) setVolume(Math.sqrt(sum / inputData.length));

            const int16Data = float32ToInt16(inputData);
            const uint8Data = new Uint8Array(int16Data.buffer);
            const base64Data = arrayBufferToBase64(uint8Data.buffer);
            
            sessionPromise
                  .then(session => {
                      if (isConnectedRef.current) {
                          try {
                            session.sendRealtimeInput({
                              media: { mimeType: 'audio/pcm;rate=16000', data: base64Data }
                            });
                          } catch(e) { }
                      }
                  })
                  .catch(() => {});
          };
          
          source.connect(processor);
          processor.connect(audioInputContextRef.current.destination);
          
          sourceRef.current = source;
          processorRef.current = processor;
        }

        // Video Input
        videoInterval = setInterval(() => {
          if (!videoRef.current || !canvasRef.current || !isConnectedRef.current) return;
          
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          canvas.width = 640;
          canvas.height = 360; 

          if (activeTabRef.current === 'code') {
             renderCodeToCanvas(ctx, canvas.width, canvas.height);
             if (isVideoOnRef.current) {
                const pipWidth = 160;
                const pipHeight = 90;
                const padding = 10;
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 2;
                ctx.strokeRect(canvas.width - pipWidth - padding, canvas.height - pipHeight - padding, pipWidth, pipHeight);
                ctx.drawImage(videoRef.current, canvas.width - pipWidth - padding, canvas.height - pipHeight - padding, pipWidth, pipHeight);
             }
          } else {
             if (isVideoOnRef.current) {
               ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
             } else {
               ctx.fillStyle = '#1e293b';
               ctx.fillRect(0, 0, canvas.width, canvas.height);
             }
          }
          
          const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
          
          sessionPromise
            .then(session => {
                if (isConnectedRef.current) {
                    try {
                        session.sendRealtimeInput({
                          media: { mimeType: 'image/jpeg', data: base64Image }
                        });
                    } catch (e) { }
                }
            })
            .catch(() => {});
            
        }, 1000);

      } catch (err: any) {
        console.error("Failed to initialize session", err);
        if (isMounted) {
            let userMsg = err.message || "Failed to initialize Gemini Live session.";
            
            if (userMsg === "INSECURE_CONTEXT") {
                userMsg = "SECURE CONNECTION REQUIRED: Browser blocks camera/mic on insecure (HTTP) connections. Use HTTPS or Localhost.";
            } else if (userMsg === "PERMISSION_DENIED") {
                userMsg = "PERMISSION DENIED: Please allow Camera & Microphone access in browser settings.";
            } else if (userMsg === "NO_DEVICES") {
                userMsg = "HARDWARE MISSING: No camera or microphone found.";
            }

            setConnectionError(userMsg);
            setIsConnecting(false);
        }
      }
    };

    initializeSession();

    return () => {
      isMounted = false;
      isConnectedRef.current = false;
      clearInterval(videoInterval);
      
      if (cleanupSession) cleanupSession();
      
      if (processorRef.current && audioInputContextRef.current) {
        processorRef.current.disconnect();
        sourceRef.current?.disconnect();
      }
      if (audioInputContextRef.current) {
          audioInputContextRef.current.close().catch(e => console.error("Error closing input ctx", e));
      }
      if (audioContextRef.current) {
          audioContextRef.current.close().catch(e => console.error("Error closing output ctx", e));
      }
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [profile]);

  const handleEndCall = () => {
    onEndInterview(transcriptRef.current || "No transcript available."); 
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex justify-between items-center border-b border-slate-700 bg-slate-900 z-10 shrink-0">
        <div className="flex items-center space-x-2 md:space-x-3">
          <div className={`w-2 h-2 rounded-full ${isConnecting ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
          <span className="font-mono text-xs md:text-sm font-semibold">{isConnecting ? 'CONNECTING...' : 'LIVE'}</span>
          <span className="text-gray-400 hidden md:inline">|</span>
          <span className="font-semibold text-sm md:text-base truncate max-w-[120px] md:max-w-none">{profile.role}</span>
        </div>
        
        {/* Mode Toggles */}
        <div className="flex bg-slate-800 rounded-lg p-1">
           <button 
             onClick={() => setActiveTab('video')}
             className={`flex items-center px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${activeTab === 'video' ? 'bg-slate-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
           >
             <Layout size={14} className="mr-1 md:mr-2" /> <span className="hidden sm:inline">Video</span>
           </button>
           <button 
             onClick={() => setActiveTab('code')}
             className={`flex items-center px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-all ${activeTab === 'code' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
           >
             <Code size={14} className="mr-1 md:mr-2" /> <span className="hidden sm:inline">Editor</span>
           </button>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="font-mono bg-slate-800 px-2 md:px-3 py-1 rounded text-xs md:text-sm">
            {formatTime(duration)}
          </div>
          {/* Desktop Chat Toggle */}
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`hidden md:flex p-2 rounded-lg transition-colors relative ${isChatOpen ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}
          >
            <MessageSquare size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Center Stage (Video OR Code) */}
        <div className="flex-1 flex flex-col relative transition-all duration-300 w-full bg-black">
          
          {/* Error Banner */}
          {connectionError && (
             <div className="absolute top-4 left-4 right-4 z-50 bg-red-600/95 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between animate-fade-in border border-red-500">
                <div className="flex items-center flex-1 mr-4">
                   {connectionError.includes("SECURE") || connectionError.includes("PERMISSION") ? 
                      <ShieldAlert size={20} className="mr-2 flex-shrink-0 text-yellow-300" /> :
                      <AlertTriangle size={20} className="mr-2 flex-shrink-0 text-yellow-300" />
                   }
                   <span className="text-xs md:text-sm font-medium">{connectionError}</span>
                </div>
                <button onClick={() => window.location.reload()} className="bg-white text-red-600 px-3 py-1 rounded text-xs font-bold uppercase hover:bg-gray-100">Retry</button>
             </div>
          )}

          {activeTab === 'video' ? (
            // --- VIDEO VIEW ---
            <div className="flex-1 flex items-center justify-center relative w-full h-full overflow-hidden">
               <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] ${!isVideoOn ? 'hidden' : ''}`}
                />
                
                {/* Fallback Avatar */}
                {!isVideoOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center">
                      <span className="text-3xl font-bold text-slate-500">{profile.name.charAt(0)}</span>
                    </div>
                  </div>
                )}

                {/* AI Avatar Overlay - Top Right */}
                <div className="absolute top-4 right-4 w-28 h-36 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 flex flex-col items-center justify-center p-3 shadow-lg z-20">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 transition-colors duration-200 ${volume > 0.01 ? 'bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)]' : 'bg-slate-700'}`}>
                    <Activity size={24} className="text-white" />
                  </div>
                  <span className="text-xs font-semibold text-white/90">Alex (AI)</span>
                </div>

                {/* MOBILE TRANSCRIPT OVERLAY */}
                <div className={`md:hidden absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 flex flex-col justify-end`}>
                  <div className="flex justify-center mb-2 pointer-events-auto">
                     <button 
                      onClick={(e) => { e.stopPropagation(); setIsMobileChatExpanded(!isMobileChatExpanded); }}
                      className="bg-black/40 hover:bg-black/60 p-1.5 rounded-full text-white/80 backdrop-blur-sm border border-white/10 shadow-sm"
                     >
                       {isMobileChatExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                     </button>
                  </div>

                  <div className={`w-full bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-8 transition-all duration-300 ${isMobileChatExpanded ? 'h-[60vh] bg-black/95' : 'h-auto'}`}>
                      <div className={`overflow-y-auto ${isMobileChatExpanded ? 'h-full' : 'max-h-32'}`}>
                          {chatHistory.length === 0 ? (
                            <div className="text-white/50 text-center text-xs italic py-1">AI is listening...</div>
                          ) : (
                            (isMobileChatExpanded ? chatHistory : chatHistory.slice(-2)).map((msg, idx) => (
                              <div key={idx} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                <span className={`inline-block px-3 py-2 rounded-xl text-xs md:text-sm leading-relaxed ${
                                  msg.role === 'user' 
                                  ? 'bg-blue-600/90 text-white rounded-br-none' 
                                  : 'bg-slate-800/90 backdrop-blur-md text-gray-100 rounded-bl-none border border-white/10'
                                }`}>
                                  {msg.text}
                                </span>
                              </div>
                            ))
                          )}
                          <div ref={chatEndRef} />
                      </div>
                  </div>
                </div>
            </div>
          ) : (
            // --- CODE EDITOR VIEW ---
            <div className="flex-1 flex flex-col md:flex-row p-2 md:p-4 space-y-2 md:space-y-0 md:space-x-4 bg-slate-900 overflow-hidden h-full">
               {/* Editor Input */}
               <div className="flex-[3] flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg min-h-0 h-full">
                  <div className="flex justify-between items-center px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0">
                     <div className="flex items-center space-x-3">
                         <span className="text-xs font-mono text-gray-400 flex items-center"><FileCode size={14} className="mr-2"/> Editor</span>
                         <div className="relative group">
                            <select 
                                value={language.id}
                                onChange={handleLanguageChange}
                                className="appearance-none bg-slate-800 text-xs text-white border border-slate-600 rounded px-3 py-1 pr-8 focus:outline-none focus:border-blue-500 cursor-pointer hover:bg-slate-700 transition"
                            >
                                {LANGUAGES.map(lang => (
                                    <option key={lang.id} value={lang.id}>{lang.name}</option>
                                ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                         </div>
                     </div>
                     <span className="text-xs text-green-400 flex items-center"><Activity size={10} className="mr-1"/> AI Watching</span>
                  </div>
                  
                  <div className="flex flex-1 relative overflow-hidden bg-[#1e1e1e]">
                      <div className="w-10 bg-[#1e1e1e] border-r border-slate-700 text-gray-600 text-right pr-2 pt-4 font-mono text-sm select-none">
                          {code.split('\n').map((_, i) => (
                              <div key={i} className="leading-6">{i + 1}</div>
                          ))}
                      </div>

                      <textarea
                         ref={editorRef}
                         value={code}
                         onChange={(e) => setCode(e.target.value)}
                         onKeyDown={handleEditorKeyDown}
                         className="flex-1 w-full bg-[#1e1e1e] text-gray-200 font-mono text-sm p-4 pt-4 outline-none resize-none leading-6 whitespace-pre"
                         spellCheck={false}
                         autoCapitalize="off"
                         autoComplete="off"
                         autoCorrect="off"
                      />
                  </div>
               </div>

               {/* Right Panel: Tabs for Console / Task / Video */}
               <div className="flex-[2] md:w-1/3 flex flex-col h-full md:h-auto overflow-hidden rounded-xl border border-slate-700 bg-black shadow-lg">
                   {/* Tabs Header */}
                   <div className="flex border-b border-slate-700 bg-slate-900">
                       <button 
                         onClick={() => setRightPanelTab('task')}
                         className={`flex-1 py-2 text-xs font-medium flex items-center justify-center space-x-2 transition-colors ${rightPanelTab === 'task' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}
                       >
                           <ClipboardList size={14} /> <span>Task</span>
                           {currentTask && <span className="w-2 h-2 rounded-full bg-blue-500 ml-1"></span>}
                       </button>
                       <button 
                         onClick={() => setRightPanelTab('console')}
                         className={`flex-1 py-2 text-xs font-medium flex items-center justify-center space-x-2 transition-colors ${rightPanelTab === 'console' ? 'bg-slate-800 text-green-400 border-b-2 border-green-500' : 'text-gray-400 hover:text-white'}`}
                       >
                           <Terminal size={14} /> <span>Output</span>
                       </button>
                       <button 
                         onClick={() => setRightPanelTab('video')}
                         className={`flex-1 py-2 text-xs font-medium flex items-center justify-center space-x-2 transition-colors ${rightPanelTab === 'video' ? 'bg-slate-800 text-purple-400 border-b-2 border-purple-500' : 'text-gray-400 hover:text-white'}`}
                       >
                           <Video size={14} /> <span>Me</span>
                       </button>
                   </div>

                   {/* Tab Content */}
                   <div className="flex-1 overflow-hidden relative">
                       {/* TASK TAB */}
                       {rightPanelTab === 'task' && (
                           <div className="h-full flex flex-col p-4 bg-[#1e1e1e] overflow-y-auto">
                               {currentTask ? (
                                   <div className="animate-fade-in">
                                       <h3 className="text-lg font-bold text-white mb-3">{currentTask.title}</h3>
                                       <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                                           {currentTask.description}
                                       </div>
                                       <div className="mt-6 p-3 bg-blue-900/30 border border-blue-800 rounded-lg">
                                           <div className="flex items-start text-xs text-blue-200">
                                               <CheckCircle2 size={14} className="mr-2 mt-0.5 shrink-0" />
                                               <span>When you are done, click "Run Code". The AI will automatically see your output and provide feedback.</span>
                                           </div>
                                       </div>
                                   </div>
                               ) : (
                                   <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
                                       <ClipboardList size={32} className="opacity-50" />
                                       <p className="text-sm text-center px-4">The interviewer has not assigned a specific task yet.</p>
                                   </div>
                               )}
                           </div>
                       )}

                       {/* CONSOLE TAB */}
                       {rightPanelTab === 'console' && (
                           <div className="h-full flex flex-col bg-black">
                               <div className="flex items-center justify-between p-2 border-b border-slate-800">
                                   <span className="text-xs text-gray-500 font-mono">stdout</span>
                                   <button 
                                        onClick={handleRunCode}
                                        disabled={isCompiling}
                                        className="text-[10px] bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded flex items-center transition-colors disabled:opacity-50"
                                     >
                                        {isCompiling ? <Loader2 size={12} className="animate-spin mr-1"/> : <Play size={12} className="mr-1"/>}
                                        Run & Submit
                                     </button>
                               </div>
                               <div className="flex-1 p-3 font-mono text-xs text-green-400 overflow-y-auto whitespace-pre-wrap">
                                   {compilerOutput || <span className="text-gray-600 italic">Run code to see output...</span>}
                               </div>
                           </div>
                       )}

                       {/* VIDEO TAB */}
                       {rightPanelTab === 'video' && (
                           <div className="h-full bg-black flex items-center justify-center overflow-hidden relative">
                              <video 
                                 ref={videoRef} 
                                 autoPlay 
                                 playsInline 
                                 muted 
                                 className={`w-full h-full object-cover transform scale-x-[-1] ${!isVideoOn ? 'hidden' : ''}`}
                              />
                               {!isVideoOn && (
                                   <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                                      <span className="text-slate-500 text-xs">Camera Off</span>
                                   </div>
                               )}
                           </div>
                       )}
                   </div>
               </div>
            </div>
          )}

          {/* Controls Bar */}
          <div className="h-20 flex justify-center items-center space-x-6 bg-slate-900 border-t border-slate-800 z-40 shrink-0 pb-safe relative">
            {/* Volume Visualizer Background */}
             <div className="absolute top-0 left-0 right-0 h-0.5 bg-slate-800">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-75 ease-out mx-auto"
                    style={{ width: `${Math.min(volume * 500, 100)}%` }}
                  />
             </div>

            <button 
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-4 rounded-full transition-all shadow-lg ${isMicOn ? 'bg-slate-800 text-white border border-slate-700' : 'bg-red-500 text-white border border-red-600'}`}
            >
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            
            <button 
              onClick={handleEndCall}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-full font-bold shadow-xl flex items-center space-x-2 text-white transform hover:scale-105 transition-all"
            >
              <PhoneOff size={24} />
            </button>

            <button 
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`p-4 rounded-full transition-all shadow-lg ${isVideoOn ? 'bg-slate-800 text-white border border-slate-700' : 'bg-red-500 text-white border border-red-600'}`}
            >
              {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
          </div>

          {/* Hidden Canvas */}
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Connecting Overlay */}
          {isConnecting && !connectionError && (
              <div className="absolute inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 animate-ping absolute inset-0"></div>
                  <div className="w-16 h-16 rounded-full border-4 border-t-blue-500 animate-spin relative z-10"></div>
                </div>
                <p className="text-blue-400 mt-6 font-medium animate-pulse">Establishing Secure Connection...</p>
                <p className="text-slate-500 text-sm mt-2">Connecting to Gemini Live API</p>
              </div>
          )}
        </div>

        {/* DESKTOP SIDEBAR DRAWER (Hidden on Mobile) */}
        <div 
            className={`
                hidden md:flex flex-col
                w-96 bg-slate-800 border-l border-slate-700 transition-all duration-300
                ${isChatOpen ? 'translate-x-0' : 'translate-x-full w-0 overflow-hidden'}
            `}
        >
           <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 backdrop-blur">
             <h3 className="font-semibold text-white flex items-center">
               <MessageSquare size={16} className="mr-2 text-blue-400" />
               Live Transcript
             </h3>
             <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-slate-700">
               <X size={20} />
             </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {chatHistory.length === 0 ? (
               <div className="text-center text-gray-500 mt-10 text-sm italic">
                 Conversation will appear here...
               </div>
             ) : (
               chatHistory.map((msg, idx) => (
                 <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                   <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                     msg.role === 'user' 
                       ? 'bg-blue-600 text-white rounded-br-none' 
                       : 'bg-slate-700 text-gray-200 rounded-bl-none border border-slate-600'
                   }`}>
                     {msg.text}
                   </div>
                   <span className="text-[10px] text-gray-500 mt-1 ml-1 font-medium uppercase">{msg.role === 'user' ? 'You' : 'Alex (AI)'}</span>
                 </div>
               ))
             )}
             <div ref={chatEndRef} />
           </div>
        </div>

      </div>
    </div>
  );
};

export default LiveInterview;