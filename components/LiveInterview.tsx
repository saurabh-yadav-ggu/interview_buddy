import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { CandidateProfile } from '../types';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Activity, Loader2, MessageSquare, X, Code, Play, Terminal, Layout } from 'lucide-react';
import { base64ToUint8Array, arrayBufferToBase64, float32ToInt16, decodeAudioData } from '../utils/audioUtils';

interface LiveInterviewProps {
  profile: CandidateProfile;
  onEndInterview: (transcript: string) => void;
}

const LiveInterview: React.FC<LiveInterviewProps> = ({ profile, onEndInterview }) => {
  // State
  const [isConnecting, setIsConnecting] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [volume, setVolume] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  
  // Code Editor State
  const [activeTab, setActiveTab] = useState<'video' | 'code'>('video');
  const [code, setCode] = useState("// Start coding here...\n// The AI will review your code as you type.\n\nfunction solution() {\n  console.log('Hello World');\n}");
  const [compilerOutput, setCompilerOutput] = useState<string>("");
  const [isCompiling, setIsCompiling] = useState(false);

  // Refs for State (to access in closures without re-triggering effects)
  const isMicOnRef = useRef(isMicOn);
  const isVideoOnRef = useRef(isVideoOn);
  const activeTabRef = useRef(activeTab);
  const codeRef = useRef(code);

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
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Transcript accumulation
  const transcriptRef = useRef<string>("");

  // Sync state to refs
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isVideoOnRef.current = isVideoOn; }, [isVideoOn]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { codeRef.current = code; }, [code]);

  // Re-attach media stream when switching tabs (since video element is unmounted/remounted)
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      // Ensure video plays after re-attaching stream (sometimes required by browsers)
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [activeTab]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // Timer
  useEffect(() => {
    const timer = setInterval(() => setDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Run Code / Compiler Simulation
  const handleRunCode = async () => {
    if (!process.env.API_KEY) return;
    setIsCompiling(true);
    setCompilerOutput("Compiling and executing...");
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Using Flash for fast "compiler-like" response
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `
          You are a strict Code Compiler and Execution Engine.
          
          TASK:
          1. Detect the programming language of the provided code.
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
      
      // Also inject this event into the transcript context so the Interviewer knows the user ran code
      transcriptRef.current += `\n[SYSTEM: User ran code. Output: ${output.slice(0, 100)}...]\n`;

    } catch (error) {
      setCompilerOutput(`Execution Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCompiling(false);
    }
  };

  // Helper to render code to canvas (so AI can "see" it)
  const renderCodeToCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Background
    ctx.fillStyle = '#1e293b'; // Slate-800
    ctx.fillRect(0, 0, width, height);

    // Text settings
    ctx.font = '14px monospace';
    ctx.fillStyle = '#e2e8f0'; // Slate-200
    ctx.textBaseline = 'top';

    const lines = codeRef.current.split('\n');
    const lineHeight = 20;
    const padding = 20;

    // Draw lines
    lines.forEach((line, index) => {
      if (index * lineHeight < height - padding) {
        ctx.fillText(line, padding, padding + (index * lineHeight));
      }
    });

    // Draw "Live Code" indicator
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('🔴 LIVE CODE VIEW', width - 180, 20);
  };

  // Main Live API Setup
  useEffect(() => {
    let isMounted = true;
    let videoInterval: NodeJS.Timeout;

    const initializeSession = async () => {
      try {
        if(!process.env.API_KEY) {
           throw new Error("API Key is missing. Please check your environment configuration.");
        }
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Setup Audio Contexts
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioInputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        
        // Important: Resume contexts to prevent "suspended" state errors in some browsers
        await audioContextRef.current.resume();
        await audioInputContextRef.current.resume();

        // Get User Media
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Updated System Instruction for Human-like Persona and Specific Greeting
        const systemInstruction = `
          You are Alex, an expert, friendly, and highly conversational Technical Recruiter.
          
          CANDIDATE: ${profile.name}
          ROLE: ${profile.role} (${profile.experienceLevel})
          
          JOB DESCRIPTION SUMMARY:
          ${profile.jobDescription.slice(0, 300)}...

          BEHAVIORAL GUIDELINES:
          1. **Greeting**: Start IMMEDIATELY by saying: "Hi ${profile.name}, I'm Alex, your AI interviewer. I'm here to see how you fit for the ${profile.role} position."
          2. **Persona & Tone**: 
             - Be professional yet approachable and warm.
             - **CRITICAL**: Use natural vocal fillers to sound human. Start responses or acknowledge points with "Hmm", "Ah", "Uh huh", "I see", or "Right". 
             - Example: "Hmm, that's a good point. Can you elaborate?" or "Ah, I see. So you used React there?"
             - Do not be robotic. Vary your intonation and responses.
          3. **Coding Assessment**: You can ask the candidate to switch to the 'Code Editor' tab to solve a problem. 
             - When they do, you will see their code on your video feed.
             - Analyze their logic and syntax as they type or explain it.
          4. **Structure**: Greeting -> Ice Breaker -> 2-3 Technical/Coding Questions -> Wrap up.

          You are interviewing them. Listen to their audio input and respond via audio.
        `;

        // Connect using callbacks (Correct Pattern)
        // Note: 'gemini-2.5-flash-native-audio-preview-09-2025' is the required model for Live API per documentation.
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => {
              console.log("Gemini Live Session Opened");
              if (isMounted) setIsConnecting(false);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (!isMounted) return;

              // --- 1. Handle Transcription (Text) ---
              // Merge consecutive messages to avoid "choppy" chat bubbles
              const outputText = message.serverContent?.outputTranscription?.text;
              const inputText = message.serverContent?.inputTranscription?.text;

              if (outputText) {
                transcriptRef.current += outputText; // Append directly to transcript string
                setChatHistory(prev => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === 'ai') {
                    // Update last AI message
                    return [...prev.slice(0, -1), { ...lastMsg, text: lastMsg.text + outputText }];
                  } else {
                    // New AI message
                    return [...prev, { role: 'ai', text: outputText }];
                  }
                });
              }

              if (inputText) {
                transcriptRef.current += inputText; // Append directly to transcript string
                setChatHistory(prev => {
                  const lastMsg = prev[prev.length - 1];
                  if (lastMsg && lastMsg.role === 'user') {
                    // Update last User message
                    return [...prev.slice(0, -1), { ...lastMsg, text: lastMsg.text + inputText }];
                  } else {
                    // New User message
                    return [...prev, { role: 'user', text: inputText }];
                  }
                });
              }

              // --- 2. Handle Audio Output ---
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
                  
                  // Track for interruption
                  sourcesRef.current.add(source);
                  source.onended = () => {
                    sourcesRef.current.delete(source);
                  };
                }
              }

              // --- 3. Handle Interruption ---
              if (message.serverContent?.interrupted) {
                console.log("Interrupted by user");
                transcriptRef.current += `\n[Interruption]\n`;
                sourcesRef.current.forEach(source => {
                  try { source.stop(); } catch(e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                if (audioContextRef.current) {
                   nextStartTimeRef.current = audioContextRef.current.currentTime;
                }
              }
            },
            onclose: () => {
              console.log("Session Closed");
            },
            onerror: (err) => {
              console.error("Session Error", err);
              // Handle generic errors gracefully
              if (isMounted && isConnecting) {
                 setIsConnecting(false);
                 alert("A connection error occurred with the AI. Please try restarting the session.");
              }
            }
          },
          config: {
            systemInstruction: systemInstruction,
            responseModalities: [Modality.AUDIO],
            // Enable transcription to capture context for the report
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
          }
        });
        
        // Handle initial connection failures (e.g. Network Error, 403, 404)
        sessionPromise.catch(err => {
            console.error("Failed to establish initial connection:", err);
            if (isMounted) {
               setIsConnecting(false);
               alert("Failed to connect to AI Service. Error: " + (err.message || "Network Error"));
            }
        });

        sessionPromiseRef.current = sessionPromise;

        // --- Audio Input Processing (Microphone -> Model) ---
        if (audioInputContextRef.current) {
          const source = audioInputContextRef.current.createMediaStreamSource(stream);
          const processor = audioInputContextRef.current.createScriptProcessor(4096, 1, 1);
          
          processor.onaudioprocess = (e) => {
            if (!isMicOnRef.current) return; // Mute logic

            const inputData = e.inputBuffer.getChannelData(0);
            
            // Calculate volume for UI visualizer
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            if (isMounted) setVolume(Math.sqrt(sum / inputData.length));

            // Convert to PCM 16kHz
            const int16Data = float32ToInt16(inputData);
            const uint8Data = new Uint8Array(int16Data.buffer);
            const base64Data = arrayBufferToBase64(uint8Data.buffer);
            
            // Send to model only after session connects
            if (sessionPromiseRef.current) {
                sessionPromiseRef.current
                  .then(session => {
                      session.sendRealtimeInput({
                        media: {
                          mimeType: 'audio/pcm;rate=16000',
                          data: base64Data
                        }
                      });
                  })
                  .catch(() => {
                      // Suppress errors here as they are handled in the main promise catch
                  });
            }
          };
          
          source.connect(processor);
          processor.connect(audioInputContextRef.current.destination);
          
          sourceRef.current = source;
          processorRef.current = processor;
        }

        // --- Video Input Processing (Canvas -> Model) ---
        videoInterval = setInterval(() => {
          if (!videoRef.current || !canvasRef.current) return;
          
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          canvas.width = 640;
          canvas.height = 360; 

          // Logic: If in 'code' tab, render code text. If in 'video' tab, render webcam.
          if (activeTabRef.current === 'code') {
             // 1. Draw Code Background & Text
             renderCodeToCanvas(ctx, canvas.width, canvas.height);

             // 2. Draw Picture-in-Picture Webcam (Bottom Right)
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
             // Standard Video View
             if (isVideoOnRef.current) {
               ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
             } else {
               ctx.fillStyle = '#1e293b';
               ctx.fillRect(0, 0, canvas.width, canvas.height);
             }
          }
          
          const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
          
          if (sessionPromiseRef.current) {
              sessionPromiseRef.current
                .then(session => {
                    session.sendRealtimeInput({
                      media: {
                        mimeType: 'image/jpeg',
                        data: base64Image
                      }
                    });
                })
                .catch(() => {
                    // Suppress errors here as they are handled in the main promise catch
                });
          }
        }, 2000); 

      } catch (err) {
        console.error("Failed to initialize session", err);
        alert("Failed to initialize Gemini Live session. Check API Key and Permissions.");
        if (isMounted) setIsConnecting(false);
      }
    };

    initializeSession();

    return () => {
      isMounted = false;
      clearInterval(videoInterval);
      
      if (processorRef.current && audioInputContextRef.current) {
        processorRef.current.disconnect();
        sourceRef.current?.disconnect();
      }

      if (audioInputContextRef.current) audioInputContextRef.current.close();
      if (audioContextRef.current) audioContextRef.current.close();

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
           // Attempt to close properly if method exists
           try { session.close(); } catch(e) {}
        });
      }
    };
  }, [profile]); // Restart if profile changes

  const handleEndCall = () => {
    // Pass the accumulated transcript to the parent for report generation
    onEndInterview(transcriptRef.current || "No transcript available."); 
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex justify-between items-center border-b border-slate-700 bg-slate-900 z-10">
        <div className="flex items-center space-x-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="font-mono text-red-400">LIVE</span>
          <span className="text-gray-400">|</span>
          <span className="font-semibold">{profile.role} Interview</span>
        </div>
        
        {/* Mode Toggles */}
        <div className="flex bg-slate-800 rounded-lg p-1">
           <button 
             onClick={() => setActiveTab('video')}
             className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'video' ? 'bg-slate-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
           >
             <Layout size={16} className="mr-2" /> Video Focus
           </button>
           <button 
             onClick={() => setActiveTab('code')}
             className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'code' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
           >
             <Code size={16} className="mr-2" /> Code Editor
           </button>
        </div>

        <div className="flex items-center space-x-4">
          <div className="font-mono bg-slate-800 px-3 py-1 rounded text-sm">
            {formatTime(duration)}
          </div>
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`p-2 rounded-lg transition-colors ${isChatOpen ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}
          >
            <MessageSquare size={20} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Center Stage (Video OR Code) */}
        <div className={`flex-1 flex flex-col relative transition-all duration-300 ${isChatOpen ? 'w-2/3' : 'w-full'}`}>
          
          {activeTab === 'video' ? (
            // --- VIDEO VIEW ---
            <div className="flex-1 flex items-center justify-center relative p-4">
              <div className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover transform scale-x-[-1] ${!isVideoOn ? 'hidden' : ''}`}
                />
                {!isVideoOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                    <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center">
                      <span className="text-2xl font-bold text-slate-500">{profile.name.charAt(0)}</span>
                    </div>
                  </div>
                )}

                {/* AI Avatar Overlay */}
                <div className="absolute top-4 right-4 w-32 h-40 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-600 flex flex-col items-center justify-center p-2 z-10">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 transition-colors ${volume > 0.01 ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-slate-700'}`}>
                    <Activity size={32} className="text-white" />
                  </div>
                  <span className="text-xs font-semibold text-blue-300">Alex (AI)</span>
                </div>
                
                {/* Audio Visualizer Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-75 ease-out"
                    style={{ width: `${Math.min(volume * 500, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            // --- CODE EDITOR VIEW ---
            <div className="flex-1 flex flex-col p-4 space-y-4 bg-slate-900">
               <div className="flex-1 flex space-x-4 min-h-0">
                  {/* Editor Input */}
                  <div className="flex-1 flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
                     <div className="flex justify-between items-center px-4 py-2 bg-slate-900 border-b border-slate-700">
                        <span className="text-xs font-mono text-gray-400 flex items-center"><Code size={14} className="mr-2"/> editor.js / .py</span>
                        <span className="text-xs text-green-400 flex items-center"><Activity size={10} className="mr-1"/> AI Watching</span>
                     </div>
                     <textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="flex-1 w-full bg-[#1e1e1e] text-gray-200 font-mono text-sm p-4 outline-none resize-none"
                        spellCheck={false}
                     />
                  </div>

                  {/* Output & Mini Video */}
                  <div className="w-1/3 flex flex-col space-y-4">
                      {/* Compiler Output */}
                      <div className="flex-1 bg-black rounded-xl border border-slate-700 overflow-hidden flex flex-col">
                         <div className="px-4 py-2 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                            <span className="text-xs font-mono text-gray-400 flex items-center"><Terminal size={14} className="mr-2"/> Console</span>
                            <button 
                               onClick={handleRunCode}
                               disabled={isCompiling}
                               className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded flex items-center transition-colors disabled:opacity-50"
                            >
                               {isCompiling ? <Loader2 size={12} className="animate-spin mr-1"/> : <Play size={12} className="mr-1"/>}
                               Run Code
                            </button>
                         </div>
                         <div className="flex-1 p-3 font-mono text-xs text-green-400 overflow-y-auto whitespace-pre-wrap">
                            {compilerOutput || <span className="text-gray-600 italic">Run code to see output...</span>}
                         </div>
                      </div>

                      {/* Mini Video Feedback */}
                      <div className="h-48 bg-black rounded-xl border border-slate-700 overflow-hidden relative">
                         <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className={`w-full h-full object-cover transform scale-x-[-1] ${!isVideoOn ? 'hidden' : ''}`}
                         />
                         <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[10px] text-white">Your Camera</div>
                      </div>
                  </div>
               </div>
            </div>
          )}

          {/* Controls Bar */}
          <div className="h-20 flex justify-center items-center space-x-6 bg-slate-900 border-t border-slate-800 z-20">
            <button 
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-3 rounded-full transition-all ${isMicOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'}`}
              title="Toggle Microphone"
            >
              {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            
            <button 
              onClick={handleEndCall}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-full font-bold shadow-lg transform hover:scale-105 transition-all flex items-center space-x-2"
            >
              <PhoneOff size={20} />
              <span>End Interview</span>
            </button>

            <button 
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`p-3 rounded-full transition-all ${isVideoOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'}`}
              title="Toggle Camera"
            >
              {isVideoOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          </div>

          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Connecting Overlay */}
          {isConnecting && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-blue-200">Connecting to Gemini Live...</p>
              </div>
          )}
        </div>

        {/* Live Transcript Sidebar */}
        <div className={`bg-slate-800 border-l border-slate-700 transition-all duration-300 flex flex-col ${isChatOpen ? 'w-96 translate-x-0' : 'w-0 translate-x-full overflow-hidden'}`}>
           <div className="p-4 border-b border-slate-700 flex justify-between items-center">
             <h3 className="font-semibold text-white flex items-center">
               <MessageSquare size={16} className="mr-2 text-blue-400" />
               Live Transcript
             </h3>
             <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white">
               <X size={18} />
             </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {chatHistory.length === 0 ? (
               <div className="text-center text-gray-500 mt-10 text-sm">
                 <p>Conversation will appear here...</p>
               </div>
             ) : (
               chatHistory.map((msg, idx) => (
                 <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                   <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                     msg.role === 'user' 
                       ? 'bg-blue-600 text-white rounded-br-none' 
                       : 'bg-slate-700 text-gray-200 rounded-bl-none'
                   }`}>
                     {msg.text}
                   </div>
                   <span className="text-xs text-gray-500 mt-1 ml-1">{msg.role === 'user' ? 'You' : 'Alex (AI)'}</span>
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