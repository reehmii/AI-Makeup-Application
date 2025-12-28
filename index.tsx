import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Sparkles, ChevronRight, Info, Zap, X, User, Hand, Share2, Save, Sun, Moon, CheckCircle, ArrowLeft, Loader2, Palette, Scissors, Gem, Eye, Smile, Video, AlertTriangle, Layers, Spline, Camera as CameraIcon } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Constants & Types ---

// Using flash for fast multi-modal analysis (VQA) and JSON generation
const MODEL_ANALYSIS = 'gemini-flash-latest'; 
// Using pro-image for high fidelity texture-preserving generation
const MODEL_VISUALIZATION = 'gemini-3-pro-image-preview'; 

type ViewState = 'welcome' | 'scan-face' | 'scan-hand' | 'analyzing' | 'dashboard' | 'try-on-result';

interface AnalysisResult {
  faceShape: string;
  skinTone: string;
  undertone: string;
  hairTexture: string;
  lightingQuality: 'High' | 'Medium' | 'Risky';
  lightingReason: string;
  confidenceScore: number;
}

interface StyleItem {
  name: string;
  description: string;
  colorHex?: string; 
  reason: string;
}

interface LookBoard {
  id: string;
  title: string;
  occasion: string; 
  vibe: string; 
  makeup: {
    lips: StyleItem;
    eyes: StyleItem;
    cheeks: StyleItem;
  };
  hair: StyleItem;
  nails: StyleItem & { shape: string };
  accessories: {
    earrings: StyleItem;
    nosePin?: StyleItem;
  };
}

interface AppState {
  view: ViewState;
  faceImage: string | null;
  handImage: string | null;
  analysis: AnalysisResult | null;
  looks: LookBoard[];
  selectedLook: LookBoard | null;
  tryOnImage: string | null;
  isGeneratingTryOn: boolean;
  error: string | null;
}

// --- Helper Components ---

const LoadingSpinner = ({ label }: { label?: string }) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-4">
    <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
    {label && <p className="text-sm text-gray-400 animate-pulse">{label}</p>}
  </div>
);

const ConfidenceMeter = ({ score, level }: { score: number; level: string }) => {
  let color = 'bg-red-500';
  if (level === 'High') color = 'bg-emerald-500';
  if (level === 'Medium') color = 'bg-amber-500';

  return (
    <div className="flex items-center space-x-2 bg-white/5 rounded-full px-3 py-1 border border-white/10">
      <div className={`w-2 h-2 rounded-full ${color} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
      <span className="text-xs font-medium text-gray-300">
        Relability: <span className="text-white">{level}</span>
      </span>
    </div>
  );
};

// --- Main Application ---

const App = () => {
  const [state, setState] = useState<AppState>({
    view: 'welcome',
    faceImage: null,
    handImage: null,
    analysis: null,
    looks: [],
    selectedLook: null,
    tryOnImage: null,
    isGeneratingTryOn: false,
    error: null,
  });

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // --- Actions ---

  const handleCapture = (imageSrc: string, type: 'face' | 'hand') => {
    setState(prev => {
      const next = { ...prev };
      if (type === 'face') {
        next.faceImage = imageSrc;
        next.view = 'scan-hand'; // Move to next step
      } else {
        next.handImage = imageSrc;
        next.view = 'analyzing'; // Start analysis
      }
      return next;
    });
  };

  const skipHandScan = () => {
    setState(prev => ({ ...prev, view: 'analyzing' }));
  };

  // Run AI Analysis when entering 'analyzing' view
  useEffect(() => {
    if (state.view === 'analyzing' && state.faceImage && !state.analysis) {
      runAnalysis();
    }
  }, [state.view]);

  const runAnalysis = async () => {
    try {
      if (!state.faceImage) throw new Error("No face image captured");

      const prompt = `
        You are an elite Stylist and Computer Vision expert.
        Analyze this selfie. 
        1. DETECT: Face shape, skin tone (Fair, Light, Medium, Tan, Deep, Dark), specific undertone (Cool, Warm, Neutral, Olive), and hair texture.
        2. CHECK QUALITY: Evaluate lighting. Is it good for color analysis? If shadows or low light, confidence is 'Medium' or 'Risky'.
        3. GENERATE LOOKS: Create 3 complete "Look Boards" (Daily, Glam, Party/Wedding) tailored perfectly to this face.
           - Lipstick shades must match the undertone.
           - Hairstyles must suit the face shape.
           - Accessories must balance features.
        
        Return JSON.
      `;

      // Helper to strip data URL prefix for API
      const base64Data = state.faceImage.split(',')[1];

      const response = await ai.models.generateContent({
        model: MODEL_ANALYSIS,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.OBJECT,
                properties: {
                  faceShape: { type: Type.STRING },
                  skinTone: { type: Type.STRING },
                  undertone: { type: Type.STRING },
                  hairTexture: { type: Type.STRING },
                  lightingQuality: { type: Type.STRING, enum: ["High", "Medium", "Risky"] },
                  lightingReason: { type: Type.STRING },
                  confidenceScore: { type: Type.NUMBER },
                }
              },
              looks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    occasion: { type: Type.STRING },
                    vibe: { type: Type.STRING },
                    makeup: {
                      type: Type.OBJECT,
                      properties: {
                        lips: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, colorHex: { type: Type.STRING }, reason: { type: Type.STRING } } },
                        eyes: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, colorHex: { type: Type.STRING }, reason: { type: Type.STRING } } },
                        cheeks: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, colorHex: { type: Type.STRING }, reason: { type: Type.STRING } } },
                      }
                    },
                    hair: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, reason: { type: Type.STRING } } },
                    nails: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, colorHex: { type: Type.STRING }, shape: { type: Type.STRING }, reason: { type: Type.STRING } } },
                    accessories: {
                      type: Type.OBJECT,
                      properties: {
                        earrings: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, reason: { type: Type.STRING } } },
                        nosePin: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, reason: { type: Type.STRING } } },
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text);
      
      setState(prev => ({
        ...prev,
        analysis: result.analysis,
        looks: result.looks,
        view: 'dashboard'
      }));

    } catch (e) {
      console.error(e);
      setState(prev => ({ ...prev, error: "Failed to analyze profile. Please try again in better lighting." }));
    }
  };

  const handleGenerateTryOn = async (look: LookBoard) => {
    setState(prev => ({ ...prev, selectedLook: look, isGeneratingTryOn: true, view: 'try-on-result' }));
    
    try {
      if (!state.faceImage) throw new Error("No source image");
      const base64Data = state.faceImage.split(',')[1];

      // Prompt for image generation
      const prompt = `
        Photorealistic virtual try-on.
        Input image: A user selfie.
        Task: Apply the following style makeover to the user while maintaining their EXACT facial identity, skin texture, and lighting conditions. Do not beautify or smooth the skin excessively.
        
        Makeup:
        - Lips: ${look.makeup.lips.name} (${look.makeup.lips.description})
        - Eyes: ${look.makeup.eyes.name} (${look.makeup.eyes.description})
        - Cheeks: ${look.makeup.cheeks.name}
        
        Hair:
        - Style: ${look.hair.name} (${look.hair.description})
        
        Accessories:
        - Earrings: ${look.accessories.earrings.name}
        
        The result must look like a real photo, not a filter. High fidelity. 
      `;

      const response = await ai.models.generateContent({
        model: MODEL_VISUALIZATION,
        contents: {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
          ]
        },
        config: {
          imageConfig: {
             imageSize: "1K", // High quality for details
             aspectRatio: "3:4" 
          }
        }
      });

      // Extract image
      // For generateContent with image models, we iterate parts
      let generatedImage = null;
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
           if (part.inlineData) {
             generatedImage = `data:image/png;base64,${part.inlineData.data}`;
             break;
           }
        }
      }

      if (!generatedImage) throw new Error("No image generated");

      setState(prev => ({
        ...prev,
        tryOnImage: generatedImage,
        isGeneratingTryOn: false
      }));

    } catch (e) {
      console.error(e);
      setState(prev => ({ 
        ...prev, 
        isGeneratingTryOn: false, 
        error: "Failed to generate try-on. Please try again." 
      }));
    }
  };

  // --- Views ---

  if (state.view === 'welcome') {
    return (
      <div className="h-screen w-full relative overflow-hidden bg-[#0f0f11] flex flex-col items-center justify-end pb-12">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?q=80&w=1287&auto=format&fit=crop" 
            className="w-full h-full object-cover opacity-60"
            alt="Background"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f11] via-[#0f0f11]/80 to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-md px-6 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 backdrop-blur-lg border border-white/20 mb-4">
            <Sparkles className="w-8 h-8 text-rose-300" />
          </div>
          
          <h1 className="text-4xl font-serif font-bold text-white tracking-tight">
            Aura Style AI
          </h1>
          <p className="text-lg text-gray-300 font-light leading-relaxed">
            Discover your perfect look with true-to-life AI analysis. 
            No fake filters, just data-driven styling.
          </p>

          <button 
            onClick={() => setState(prev => ({ ...prev, view: 'scan-face' }))}
            className="w-full py-4 bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all rounded-xl font-medium text-white shadow-[0_0_20px_rgba(244,63,94,0.4)] flex items-center justify-center space-x-2"
          >
            <Camera className="w-5 h-5" />
            <span>Start Face Analysis</span>
          </button>
        </div>
      </div>
    );
  }

  if (state.view === 'scan-face' || state.view === 'scan-hand') {
    return (
      <CameraView 
        mode={state.view === 'scan-face' ? 'face' : 'hand'}
        onCapture={(img) => handleCapture(img, state.view === 'scan-face' ? 'face' : 'hand')}
        onSkip={state.view === 'scan-hand' ? skipHandScan : undefined}
      />
    );
  }

  if (state.view === 'analyzing') {
    return (
      <div className="h-screen w-full bg-[#0f0f11] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Abstract animated background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-500/20 rounded-full blur-[100px] animate-pulse" />
        
        <div className="relative z-10 flex flex-col items-center space-y-8 text-center">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-2 border-rose-500/30 flex items-center justify-center animate-spin-slow">
              <div className="w-24 h-24 rounded-full border border-rose-400/50" />
            </div>
            <img 
              src={state.faceImage!} 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full object-cover border-2 border-white/20"
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-serif text-white">Analyzing Profile</h2>
            <div className="flex flex-col items-center space-y-1 text-sm text-gray-400">
              <span className="animate-fade-in-up delay-100">Mapping face landmarks...</span>
              <span className="animate-fade-in-up delay-300">Detecting undertone & melanin...</span>
              <span className="animate-fade-in-up delay-500">Calculating lighting quality...</span>
              <span className="animate-fade-in-up delay-700">Curating style boards...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.view === 'dashboard' && state.analysis) {
    return (
      <div className="min-h-screen bg-[#0f0f11] pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-[#0f0f11]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-serif text-white">Your Aura Profile</h1>
          <div 
             className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden border border-white/20"
             onClick={() => setState(prev => ({ ...prev, view: 'welcome' }))}
          >
            <img src={state.faceImage!} className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Analysis Summary Card */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-sm uppercase tracking-wider text-gray-400 font-medium mb-1">Skin & Tone</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-serif text-white">{state.analysis.skinTone}</span>
                  <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-rose-200 border border-white/10">
                    {state.analysis.undertone}
                  </span>
                </div>
              </div>
              <ConfidenceMeter 
                score={state.analysis.confidenceScore} 
                level={state.analysis.lightingQuality} 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center space-x-2 mb-1 text-gray-400">
                  <Smile className="w-4 h-4" />
                  <span className="text-xs">Face Shape</span>
                </div>
                <p className="text-white font-medium">{state.analysis.faceShape}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center space-x-2 mb-1 text-gray-400">
                  <Scissors className="w-4 h-4" />
                  <span className="text-xs">Texture</span>
                </div>
                <p className="text-white font-medium">{state.analysis.hairTexture}</p>
              </div>
            </div>

            {state.analysis.lightingQuality !== 'High' && (
              <div className="flex items-start space-x-2 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200 leading-relaxed">
                  {state.analysis.lightingReason} Results might be less accurate.
                </p>
              </div>
            )}
          </div>

          {/* Look Boards */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-white flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-rose-400" />
              Curated For You
            </h2>
            
            <div className="flex flex-col space-y-6">
              {state.looks.map((look, idx) => (
                <LookCard 
                  key={idx} 
                  look={look} 
                  onTryOn={() => handleGenerateTryOn(look)} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.view === 'try-on-result') {
    return (
      <div className="h-screen w-full bg-[#0f0f11] flex flex-col">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
          <button 
            onClick={() => setState(prev => ({ ...prev, view: 'dashboard' }))}
            className="p-2 rounded-full bg-black/40 backdrop-blur text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <span className="text-white/80 text-sm font-medium backdrop-blur bg-black/40 px-3 py-1 rounded-full">
            {state.selectedLook?.title}
          </span>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Main Content */}
        <div className="flex-1 relative bg-gray-900 flex items-center justify-center overflow-hidden">
          {state.isGeneratingTryOn ? (
            <div className="text-center space-y-4 px-6">
              <div className="w-16 h-16 border-t-2 border-rose-500 rounded-full animate-spin mx-auto" />
              <h3 className="text-xl font-serif text-white">Generating Realism...</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Applying makeup texture, adjusting lighting, and rendering hairstyle. This takes a few seconds.
              </p>
            </div>
          ) : (
            <div className="relative w-full h-full">
              <img 
                src={state.tryOnImage!} 
                className="w-full h-full object-cover"
                alt="Try On Result" 
              />
              
              {/* Comparison Toggle (Visual Only for Demo) */}
              <div className="absolute bottom-32 right-6">
                 <div className="bg-black/60 backdrop-blur rounded-full px-4 py-2 text-xs text-white border border-white/10 flex items-center gap-2">
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                    High Fidelity Mode
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions Sheet */}
        {!state.isGeneratingTryOn && (
          <div className="bg-[#1a1a1c] border-t border-white/10 p-6 pb-10 rounded-t-3xl -mt-6 relative z-10">
            <div className="flex justify-between items-center mb-6">
               <div className="flex space-x-4">
                  <button className="flex flex-col items-center space-y-1 text-white/80 hover:text-white">
                    <div className="p-3 bg-white/10 rounded-full">
                      <Save className="w-5 h-5" />
                    </div>
                    <span className="text-xs">Save</span>
                  </button>
                  <button className="flex flex-col items-center space-y-1 text-white/80 hover:text-white">
                     <div className="p-3 bg-white/10 rounded-full">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="text-xs">Share</span>
                  </button>
               </div>
               
               <button className="px-6 py-3 bg-rose-500 rounded-xl text-white font-medium shadow-lg shadow-rose-500/30">
                 Shop This Look
               </button>
            </div>
            
            <div className="text-xs text-gray-500 text-center">
              AI generated results may vary from real life application.
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

// --- Sub-Components ---

const CameraView = ({ mode, onCapture, onSkip }: { mode: 'face' | 'hand', onCapture: (img: string) => void, onSkip?: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    };
    startCamera();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const vid = videoRef.current;
      const cvs = canvasRef.current;
      cvs.width = vid.videoWidth;
      cvs.height = vid.videoHeight;
      const ctx = cvs.getContext('2d');
      if (ctx) {
        // Mirror if user facing
        ctx.translate(cvs.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(vid, 0, 0);
        onCapture(cvs.toDataURL('image/jpeg', 0.85));
      }
    }
  };

  return (
    <div className="h-screen w-full bg-black relative">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-full h-full bg-black/30 mask-scan" />
        {/* Overlay SVG Guide */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 aspect-[3/4] border-2 border-white/30 rounded-[50%] opacity-50" />
        {mode === 'face' && (
           <p className="absolute top-1/4 left-0 right-0 text-center text-white/80 text-lg font-medium drop-shadow-md">
             Position face in oval
           </p>
        )}
        {mode === 'hand' && (
           <p className="absolute top-1/4 left-0 right-0 text-center text-white/80 text-lg font-medium drop-shadow-md">
             Show hand for undertone verification
           </p>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center space-y-6">
        <button 
          onClick={capture}
          className="w-20 h-20 rounded-full bg-white border-4 border-gray-300 shadow-[0_0_0_4px_rgba(255,255,255,0.3)] active:scale-95 transition-transform"
        />
        {onSkip && (
          <button onClick={onSkip} className="text-white/60 text-sm hover:text-white underline">
            Skip this step
          </button>
        )}
      </div>
    </div>
  );
};

const LookCard = ({ look, onTryOn }: { look: LookBoard; onTryOn: () => void }) => {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
      <div className="p-5 border-b border-white/5 flex justify-between items-start bg-gradient-to-r from-rose-500/10 to-transparent">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">{look.occasion}</span>
            <span className="w-1 h-1 rounded-full bg-gray-500" />
            <span className="text-xs text-gray-400">{look.vibe}</span>
          </div>
          <h3 className="text-xl font-serif text-white">{look.title}</h3>
        </div>
        <button 
          onClick={onTryOn}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-white text-xs font-medium flex items-center space-x-1 shadow-lg shadow-rose-900/20 transition-all"
        >
          <Sparkles className="w-3 h-3" />
          <span>Try On</span>
        </button>
      </div>
      
      <div className="p-5 space-y-4">
        {/* Makeup Section */}
        <div className="space-y-3">
          <SectionHeader icon={<Palette className="w-3 h-3" />} title="Makeup Palette" />
          <div className="grid grid-cols-3 gap-2">
            <ColorSwatch label="Lips" item={look.makeup.lips} />
            <ColorSwatch label="Eyes" item={look.makeup.eyes} />
            <ColorSwatch label="Cheeks" item={look.makeup.cheeks} />
          </div>
        </div>

        {/* Hair & Nails */}
        <div className="grid grid-cols-2 gap-4">
           <div>
             <SectionHeader icon={<Scissors className="w-3 h-3" />} title="Hair" />
             <p className="text-sm text-gray-300 mt-1">{look.hair.name}</p>
             <p className="text-xs text-gray-500 line-clamp-2">{look.hair.reason}</p>
           </div>
           <div>
             <SectionHeader icon={<Hand className="w-3 h-3" />} title="Nails" />
             <div className="flex items-center space-x-2 mt-1">
               {look.nails.colorHex && <div className="w-4 h-4 rounded-full border border-white/20" style={{backgroundColor: look.nails.colorHex}} />}
               <span className="text-sm text-gray-300">{look.nails.shape}</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <div className="flex items-center space-x-2 text-gray-500">
    {icon}
    <span className="text-xs font-medium uppercase tracking-wider">{title}</span>
  </div>
);

const ColorSwatch = ({ label, item }: { label: string; item: StyleItem }) => (
  <div className="flex flex-col space-y-1">
    <div 
      className="w-full aspect-video rounded-md border border-white/10 relative overflow-hidden group"
      style={{ backgroundColor: item.colorHex || '#333' }}
    >
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
        <p className="text-[10px] text-white text-center leading-tight">{item.name}</p>
      </div>
    </div>
    <span className="text-[10px] text-gray-400">{label}</span>
  </div>
);

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
