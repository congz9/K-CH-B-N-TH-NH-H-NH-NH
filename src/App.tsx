import { useState, useEffect, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Clapperboard, 
  Play, 
  Pause, 
  Image as ImageIcon, 
  FileText, 
  LayoutGrid, 
  Film, 
  Loader2, 
  ChevronRight, 
  ChevronLeft,
  RefreshCw,
  Download,
  Sparkles,
  Upload,
  X,
  Video,
  User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { analyzeScript, generateStoryboardImage, generateCharacterConcept, generateVideo } from "./services/geminiService";
import { Scene, Shot, ScriptAnalysis, Character } from "./types";
import { cn } from "@/lib/utils";
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db } from "./lib/firebase";
import type { User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, orderBy } from "firebase/firestore";

const SAMPLE_SCRIPT = `SCENE 1: THE LONELY ROBOT'S WORKSHOP - NIGHT
A small, rusty robot named B-12 sits at a cluttered workbench. 
B-12 is trying to fix a small mechanical bird.
The bird's wing is broken. B-12 looks sad.
Suddenly, the bird's eyes flicker blue. It chirps weakly.
B-12's eyes light up with hope.

SCENE 2: THE ROOFTOP - DAWN
B-12 and the bird are on the rooftop.
The sun is beginning to rise over a futuristic, overgrown city.
B-12 holds the bird up. The bird flaps its wings.
The bird takes flight, circling B-12.
B-12 waves goodbye, a digital smile appearing on its screen.`;

const STORYBOARD_STYLES = [
  { 
    id: "Sketch", 
    name: "Sketch", 
    description: "Bản phác thảo trắng đen truyền thống", 
    image: "https://image.pollinations.ai/prompt/Professional%20black%20and%20white%20storyboard%20sketch%20of%20a%20sci-fi%20city%20with%20clean%20lines?width=400&height=300&nologo=true&seed=42",
    icon: "✏️" 
  },
  { 
    id: "2D Animation", 
    name: "2D Animation", 
    description: "Phong cách hoạt hình 2D hiện đại", 
    image: "https://image.pollinations.ai/prompt/Clean%202D%20vector%20animation%20style%20flat%20colors%20of%20a%20fantasy%20landscape?width=400&height=300&nologo=true&seed=100",
    icon: "🎨" 
  },
  { 
    id: "3D Render", 
    name: "3D Render", 
    description: "Phong cách 3D Pixar/Disney", 
    image: "https://image.pollinations.ai/prompt/High-quality%203D%20animation%20render%20Pixar%20style%20of%20a%20cute%20robot%20in%20a%20forest?width=400&height=300&nologo=true&seed=200",
    icon: "🧊" 
  },
  { 
    id: "Anime", 
    name: "Anime", 
    description: "Phong cách hoạt hình Nhật Bản", 
    image: "https://image.pollinations.ai/prompt/Classic%20Japanese%20anime%20style%20Studio%20Ghibli%20inspired%20magical%20forest%20with%20vibrant%20colors?width=400&height=300&nologo=true&seed=300",
    icon: "🌸" 
  },
  { 
    id: "Cinematic Concept Art", 
    name: "Cinematic", 
    description: "Nghệ thuật ý tưởng điện ảnh", 
    image: "https://image.pollinations.ai/prompt/Epic%20cinematic%20concept%20art%20dramatic%20lighting%20of%20a%20hero%20standing%20on%20a%20mountain%20peak?width=400&height=300&nologo=true&seed=400",
    icon: "🎬" 
  },
  { 
    id: "Cyberpunk", 
    name: "Cyberpunk", 
    description: "Tương lai, đèn neon rực rỡ", 
    image: "https://image.pollinations.ai/prompt/Cyberpunk%20aesthetic%20neon%20lights%20rainy%20night%20futuristic%20city%20street?width=400&height=300&nologo=true&seed=500",
    icon: "🌃" 
  },
  { 
    id: "Watercolor", 
    name: "Watercolor", 
    description: "Tranh màu nước mộng mơ", 
    image: "https://image.pollinations.ai/prompt/Soft%20watercolor%20painting%20style%20dreamy%20atmosphere%20of%20a%20beautiful%20castle?width=400&height=300&nologo=true&seed=600",
    icon: "🖌️" 
  },
];

const AI_MODELS = [
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Tốc độ cực nhanh, phù hợp cho phác thảo", icon: "⚡" },
  { id: "gemini-3.1-flash-image-preview", name: "Banana 2", description: "Mô hình tạo ảnh siêu tốc thế hệ mới (2K)", icon: "🍌" },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", description: "Chất lượng cao nhất, chi tiết nghệ thuật", icon: "💎" },
  { id: "imagen-4.0-generate-001", name: "Imagen 4 (Labs)", description: "Mô hình tạo ảnh siêu thực từ Google Labs", icon: "🎨" },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");
  const [script, setScript] = useState(SAMPLE_SCRIPT);
  const [analysis, setAnalysis] = useState<ScriptAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState("script");
  const [generatingImages, setGeneratingImages] = useState<Record<string, boolean>>({});
  const [generatingVideos, setGeneratingVideos] = useState<Record<string, boolean>>({});
  const [generatingCharacters, setGeneratingCharacters] = useState<Record<string, boolean>>({});
  const [isVeoUnlocked, setIsVeoUnlocked] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("Sketch");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Animatic Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [allShots, setAllShots] = useState<Shot[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const playerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Check if Veo is unlocked via API key selection
    const checkVeo = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsVeoUnlocked(hasKey);
      }
    };
    checkVeo();
  }, []);

  useEffect(() => {
    if (analysis) {
      const flattened = analysis.scenes.flatMap(scene => scene.shots);
      setAllShots(flattened);
    }
  }, [analysis]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user settings
        getDoc(doc(db, "users", currentUser.uid)).then((docSnap) => {
          if (docSnap.exists()) {
            setSelectedModel(docSnap.data().preferredModel || "gemini-3-flash-preview");
          } else {
            // Initialize user profile
            setDoc(doc(db, "users", currentUser.uid), {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              preferredModel: "gemini-3-flash-preview"
            });
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAnalysis(null);
      setAllShots([]);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleGenerateVideo = async (shotId: string, description: string, imageUrl?: string) => {
    if (!isVeoUnlocked) {
      // @ts-ignore
      if (window.aistudio?.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
        setIsVeoUnlocked(true);
        return;
      }
    }

    setGeneratingVideos(prev => ({ ...prev, [shotId]: true }));
    try {
      const videoUrl = await generateVideo(description, "16:9", imageUrl);
      
      const newAnalysis = { ...analysis! };
      newAnalysis.scenes = newAnalysis.scenes.map(scene => ({
        ...scene,
        shots: scene.shots.map(shot => 
          shot.id === shotId ? { ...shot, videoUrl } : shot
        )
      }));
      setAnalysis(newAnalysis);
    } catch (error: any) {
      console.error("Video generation error:", error);
      if (error?.message === "API_KEY_RESET_REQUIRED") {
        // @ts-ignore
        if (window.aistudio?.openSelectKey) {
          // @ts-ignore
          await window.aistudio.openSelectKey();
        }
      } else {
        alert("Có lỗi xảy ra khi tạo video. Vui lòng kiểm tra lại cấu hình API key (cần project trả phí cho Veo).");
      }
    } finally {
      setGeneratingVideos(prev => ({ ...prev, [shotId]: false }));
    }
  };

  const handleDownloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    if (user) {
      await setDoc(doc(db, "users", user.uid), { preferredModel: modelId }, { merge: true });
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
        setSelectedStyle("Reference");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeScript(script, selectedModel);
      setAnalysis(result);
      setActiveTab("characters");

      // We no longer auto-generate storyboard images. 
      // Instead, we guide the user to generate character concepts first.
    } catch (error: any) {
      console.error(error);
      alert(`Lỗi: ${error?.message || "Không thể phân tích kịch bản"}`);
      if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED") || error?.message?.includes("Quota exceeded")) {
        alert("Hệ thống đang tạm thời quá tải (Quota). Ứng dụng sẽ tự động thử lại sau vài giây.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateImageWithData = async (shotId: string, description: string, cameraAngle: string, characters: Character[]) => {
    setGeneratingImages(prev => ({ ...prev, [shotId]: true }));
    try {
      const characterContext = characters.map(c => `${c.name}: ${c.description}`).join("\n") || "";
      const propsContext = analysis?.props?.map(p => `${p.name}: ${p.description}`).join("\n") || "";
      const characterImages = characters.filter(c => c.imageUrl).map(c => c.imageUrl!);

      let imageModel = "gemini-2.5-flash-image";
      if (selectedModel === "imagen-4.0-generate-001") {
        imageModel = "imagen-4.0-generate-001";
      } else if (selectedModel === "gemini-3.1-flash-image-preview") {
        imageModel = "gemini-3.1-flash-image-preview";
      } else if (selectedModel === "gemini-3.1-pro-preview") {
        imageModel = "gemini-3.1-flash-image-preview";
      } else if (selectedModel === "gemini-3-flash-preview") {
        imageModel = "gemini-2.5-flash-image";
      }

      const imageUrl = await generateStoryboardImage(
        description, 
        cameraAngle, 
        selectedStyle, 
        referenceImage || undefined,
        characterContext,
        propsContext,
        characterImages,
        imageModel,
        true // Enable High Fidelity / Production Mode
      );
      setAnalysis(prev => {
        if (!prev) return null;
        return {
          ...prev,
          scenes: prev.scenes.map(scene => ({
            ...scene,
            shots: scene.shots.map(shot => 
              shot.id === shotId ? { ...shot, imageUrl } : shot
            )
          }))
        };
      });
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes("403") || error?.message?.includes("PERMISSION_DENIED")) {
        alert("Lỗi 403: Bạn không có quyền sử dụng mô hình này. Điều này thường do API Key hiện tại chưa được cấp quyền cho các mô hình thử nghiệm (Imagen 4 hoặc Gemini 3.1 Flash Image). Vui lòng chọn Gemini 3 Flash hoặc Gemini 3.1 Pro.");
      } else if (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED") || error?.message?.includes("Quota exceeded")) {
        alert("Hệ thống đang tạm thời quá tải (Quota). Ứng dụng sẽ tự động thử lại sau vài giây. Vui lòng giữ tab này mở.");
      }
    } finally {
      setGeneratingImages(prev => ({ ...prev, [shotId]: false }));
    }
  };

  const handleGenerateCharacterConcept = async (charId: string, name: string, description: string) => {
    setGeneratingCharacters(prev => ({ ...prev, [charId]: true }));
    try {
      let imageModel = "gemini-2.5-flash-image";
      if (selectedModel === "imagen-4.0-generate-001") {
        imageModel = "imagen-4.0-generate-001";
      } else if (selectedModel === "gemini-3.1-flash-image-preview") {
        imageModel = "gemini-3.1-flash-image-preview";
      } else if (selectedModel === "gemini-3.1-pro-preview") {
        imageModel = "gemini-3.1-flash-image-preview";
      } else if (selectedModel === "gemini-3-flash-preview") {
        imageModel = "gemini-2.5-flash-image";
      }

      const imageUrl = await generateCharacterConcept(
        name, 
        description, 
        selectedStyle, 
        imageModel
      );
      setAnalysis(prev => {
        if (!prev) return null;
        return {
          ...prev,
          characters: prev.characters.map(c => 
            c.id === charId ? { ...c, imageUrl } : c
          )
        };
      });
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes("403") || error?.message?.includes("PERMISSION_DENIED")) {
        alert("Lỗi 403: Không có quyền truy cập mô hình này. Vui lòng chọn mô hình khác.");
      } else {
        alert("Lỗi khi tạo hình nhân vật. Vui lòng thử lại.");
      }
    } finally {
      setGeneratingCharacters(prev => ({ ...prev, [charId]: false }));
    }
  };

  const handleUpdateCharacterDescription = (charId: string, description: string) => {
    setAnalysis(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characters: prev.characters.map(c => 
          c.id === charId ? { ...c, description } : c
        )
      };
    });
  };

  const handleGenerateImage = async (shotId: string, description: string, cameraAngle: string) => {
    if (!analysis) return;
    await handleGenerateImageWithData(shotId, description, cameraAngle, analysis.characters);
  };

  const handleGenerateAllImages = async () => {
    if (!analysis) return;
    for (const scene of analysis.scenes) {
      for (const shot of scene.shots) {
        if (!shot.imageUrl) {
          await handleGenerateImage(shot.id, shot.description, shot.cameraAngle);
          await new Promise(resolve => setTimeout(resolve, 3000)); // Reduced delay to 3s
        }
      }
    }
  };

  // Animatic Player Logic
  useEffect(() => {
    if (isPlaying && allShots.length > 0) {
      const currentShot = allShots[currentShotIndex];
      playerTimerRef.current = setTimeout(() => {
        if (currentShotIndex < allShots.length - 1) {
          setCurrentShotIndex(prev => prev + 1);
        } else {
          setIsPlaying(false);
          setCurrentShotIndex(0);
        }
      }, currentShot.duration * 1000);
    } else {
      if (playerTimerRef.current) clearTimeout(playerTimerRef.current);
    }

    return () => {
      if (playerTimerRef.current) clearTimeout(playerTimerRef.current);
    };
  }, [isPlaying, currentShotIndex, allShots]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleExportAnimatic = async () => {
    if (allShots.length === 0) return;
    
    const hasMissingImages = allShots.some(shot => !shot.imageUrl);
    if (hasMissingImages) {
      alert("Vui lòng tạo đầy đủ hình ảnh cho tất cả các Shot trước khi xuất video.");
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size (16:9)
    canvas.width = 1920;
    canvas.height = 1080;

    const stream = canvas.captureStream(30); // 30 FPS
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
      bitsPerSecond: 10000000 // 10Mbps
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `animatic-${Date.now()}.webm`;
      a.click();
      setIsExporting(false);
      setExportProgress(0);
    };

    recorder.start();

    // Play through shots
    for (let i = 0; i < allShots.length; i++) {
      const shot = allShots[i];
      setExportProgress(Math.round(((i + 1) / allShots.length) * 100));
      
      // Load image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = shot.imageUrl!;
      
      await new Promise((resolve) => {
        img.onload = () => {
          // Draw image to canvas
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
          const x = (canvas.width / 2) - (img.width / 2) * scale;
          const y = (canvas.height / 2) - (img.height / 2) * scale;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

          // Draw dialogue if exists
          if (shot.dialogue) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
            ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
            ctx.fillStyle = "white";
            ctx.font = "bold 32px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`"${shot.dialogue}"`, canvas.width / 2, canvas.height - 40);
          }

          // Draw shot info
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
          ctx.fillRect(20, 20, 200, 40);
          ctx.fillStyle = "white";
          ctx.font = "20px Inter, sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(`Khung hình ${i + 1} / ${allShots.length}`, 40, 48);

          resolve(null);
        };
      });

      // Wait for shot duration
      await new Promise(resolve => setTimeout(resolve, shot.duration * 1000));
    }

    recorder.stop();
  };

  return (
    <div className="min-h-screen bg-[#FDFDFC] text-[#1A1A1A] font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 glass-morphism border-b bg-white/80 h-16 px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center text-white transition-transform group-hover:scale-105 group-hover:rotate-3 shadow-lg shadow-black/10">
            <Clapperboard size={20} />
          </div>
          <span className="text-xl font-display font-extrabold tracking-tighter uppercase">AnimaticAI</span>
        </div>

        <div className="hidden md:flex items-center gap-1 bg-black/5 p-1 rounded-full">
          {AI_MODELS.map((model) => (
            <button
              key={model.id}
              onClick={() => handleModelChange(model.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
                selectedModel === model.id 
                  ? "bg-white text-black shadow-sm" 
                  : "text-black/40 hover:text-black/60"
              )}
            >
              {model.icon} {model.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-tight text-black/40 leading-none mb-1">Authenticated</p>
                <p className="text-sm font-semibold">{user.displayName || user.email?.split('@')[0]}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="w-10 h-10 rounded-full border border-black/5 overflow-hidden hover:border-orange-500 transition-colors"
              >
                <img src={user.photoURL || `https://avatar.vercel.sh/${user.email}`} alt="avatar" referrerPolicy="no-referrer" />
              </button>
            </div>
          ) : (
            <Button 
              onClick={handleLogin} 
              className="rounded-full bg-black hover:bg-black/80 px-6 font-display font-semibold"
            >
              Đăng nhập
            </Button>
          )}
        </div>
      </nav>

      {/* Hero Section (Only if no analysis) */}
      {!analysis && (
        <header className="pt-20 pb-10 px-6 max-w-4xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100 text-[10px] font-bold uppercase tracking-widest">
            <Sparkles size={12} />
            AI-Powered Storyboarding
          </div>
          <h2 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-[0.95] text-balance">
            Biến kịch bản thành <span className="text-orange-500">phim hoạt hình</span> chỉ trong tích tắc.
          </h2>
        </header>
      )}

      <main className={cn(
        "max-w-[1600px] mx-auto px-6 py-8 grid gap-10",
        analysis ? "lg:grid-cols-12" : "max-w-4xl"
      )}>
        {/* Left Sidebar: Controls & Script */}
        <div className={cn(
          "space-y-8",
          analysis ? "lg:col-span-4" : ""
        )}>
          {/* Settings Card */}
          <Card className="border-none shadow-2xl shadow-black/5 bg-white overflow-hidden rounded-3xl">
            <CardHeader className="pb-4 bg-black/[0.01] border-b border-black/[0.03]">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <Play size={16} className="text-orange-500" />
                Cấu hình Studio
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Character Tags */}
              {analysis && (analysis.characters.length > 0 || (analysis.props && analysis.props.length > 0)) && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30">Dàn nhân vật & Đạo cụ</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.characters.map((char) => (
                      <div key={char.id} className="relative group">
                        <div className={cn(
                          "px-3 py-1.5 rounded-xl border transition-all text-[10px] font-bold uppercase",
                          char.imageUrl ? "border-orange-200 bg-orange-50 text-orange-700" : "border-black/5 bg-black/[0.02]"
                        )}>
                          {char.name}
                        </div>
                      </div>
                    ))}
                    {analysis.props?.map((prop) => (
                      <div key={prop.id} className="px-3 py-1.5 rounded-xl border border-black/5 bg-black/[0.02] text-[10px] font-bold uppercase text-black/50">
                        {prop.name}
                      </div>
                    ))}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-[10px] uppercase font-bold tracking-widest py-4 border-dashed border-black/10 hover:border-orange-500 mt-2"
                    onClick={() => setActiveTab("script")}
                  >
                    Xem chi tiết tài nguyên
                  </Button>
                </div>
              )}

              <Separator className="bg-black/[0.03]" />

              {/* Style Selection */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30">Phong cách nghệ thuật</h4>
                <div className="grid grid-cols-3 gap-2">
                  {STORYBOARD_STYLES.slice(0, 6).map((style) => (
                    <button
                      key={style.id}
                      onClick={() => {
                        setSelectedStyle(style.id);
                        setReferenceImage(null);
                      }}
                      className={cn(
                        "relative aspect-square rounded-2xl overflow-hidden border-2 transition-all group",
                        selectedStyle === style.id && !referenceImage
                          ? "border-orange-500 shadow-lg shadow-orange-500/10" 
                          : "border-transparent hover:border-black/10"
                      )}
                    >
                      <img 
                        src={style.image} 
                        alt={style.name} 
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/80 to-transparent">
                        <span className="text-[7px] text-white font-black uppercase text-center block leading-tight">{style.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />
                
                {!referenceImage ? (
                  <Button 
                    variant="outline" 
                    className="w-full border-dashed border-black/10 hover:border-orange-500 hover:bg-orange-50 h-10 rounded-2xl text-[10px] font-bold uppercase tracking-widest"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={14} className="mr-2" />
                    Dùng ảnh tham chiếu
                  </Button>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-orange-500 cinematic-glow">
                    <img src={referenceImage} className="w-full aspect-video object-cover" />
                    <button 
                      className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full backdrop-blur-md hover:bg-red-500 transition-colors"
                      onClick={() => {
                        setReferenceImage(null);
                        setSelectedStyle("Sketch");
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-6 border-t border-black/[0.03]">
                 {!isVeoUnlocked ? (
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold py-6 text-sm shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all"
                    onClick={async () => {
                      // @ts-ignore
                      if (window.aistudio?.openSelectKey) {
                        // @ts-ignore
                        await window.aistudio.openSelectKey();
                        setIsVeoUnlocked(true);
                      }
                    }}
                  >
                    <Video size={18} className="mr-2" />
                    Mở khóa AI Video (Veo)
                  </Button>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">AI Video Enabled</span>
                    </div>
                    <Video size={14} className="text-indigo-400" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Script Editor Card */}
          <Card className="border-none shadow-2xl shadow-black/5 bg-white overflow-hidden rounded-3xl">
            <CardHeader className="pb-4 bg-black/[0.01] border-b border-black/[0.03]">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <FileText size={16} className="text-orange-500" />
                Soạn thảo kịch bản
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Textarea 
                placeholder="Ví dụ: SCENE 1: KHU RỪNG - NGÀY..." 
                className="min-h-[400px] border-none focus-visible:ring-0 bg-transparent font-mono text-sm p-6 leading-relaxed resize-none placeholder:text-black/20"
                value={script}
                onChange={(e) => setScript(e.target.value)}
              />
              <div className="p-4 border-t border-black/[0.03] bg-black/[0.01]">
                <Button 
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 rounded-2xl font-display font-bold text-lg shadow-xl shadow-orange-500/20 active:scale-[0.98] transition-all"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !script.trim()}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Tạo bộ phim của tôi
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Content Area: Storyboard & Visualization */}
        {analysis && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between glass-morphism p-2 rounded-2xl sticky top-20 z-40">
              <TabsList className="bg-transparent gap-1">
                  <TabsTrigger 
                    value="characters" 
                    className="rounded-xl px-6 py-2.5 data-[state=active]:bg-black data-[state=active]:text-white transition-all font-display font-bold text-xs uppercase tracking-widest"
                  >
                    Nhân vật
                  </TabsTrigger>
                  <TabsTrigger 
                    value="storyboard" 
                    className="rounded-xl px-6 py-2.5 data-[state=active]:bg-black data-[state=active]:text-white transition-all font-display font-bold text-xs uppercase tracking-widest"
                  >
                    Storyboard
                  </TabsTrigger>
                  <TabsTrigger 
                    value="animatic" 
                    className="rounded-xl px-6 py-2.5 data-[state=active]:bg-black data-[state=active]:text-white transition-all font-display font-bold text-xs uppercase tracking-widest"
                  >
                    Animatic
                  </TabsTrigger>
                  <TabsTrigger 
                    value="script" 
                    className="rounded-xl px-6 py-2.5 data-[state=active]:bg-black data-[state=active]:text-white transition-all font-display font-bold text-xs uppercase tracking-widest"
                  >
                    Tài nguyên
                  </TabsTrigger>
                </TabsList>

              <div className="flex items-center gap-2 pr-2">
                {activeTab === "storyboard" && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] font-black uppercase tracking-widest text-orange-600 hover:bg-orange-50"
                    onClick={handleGenerateAllImages}
                  >
                    Tạo tất cả ảnh
                  </Button>
                )}
                {activeTab === "animatic" && allShots.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-9 text-[10px] font-black uppercase tracking-widest border-black/10"
                    onClick={handleExportAnimatic}
                    disabled={isExporting}
                  >
                    {isExporting ? <Loader2 size={14} className="animate-spin mr-2" /> : <Download size={14} className="mr-2" />}
                    {isExporting ? `Exporting ${exportProgress}%` : "Xuất WebM"}
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-6">
              <TabsContent value="characters" className="mt-0 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {analysis.characters.map((char) => (
                    <Card key={char.id} className="border-none shadow-xl shadow-black/5 bg-white overflow-hidden rounded-3xl group">
                      <div className="aspect-[4/5] bg-black/5 relative overflow-hidden">
                        {char.imageUrl ? (
                          <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                            {generatingCharacters[char.id] ? (
                              <Loader2 size={32} className="animate-spin text-orange-500" />
                            ) : (
                              <UserIcon size={48} className="text-black/10" />
                            )}
                            <p className="text-sm text-black/30 font-medium">Chưa có Concept Art cho {char.name}</p>
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                          <h4 className="text-xl font-display font-bold text-white">{char.name}</h4>
                          <p className="text-white/60 text-xs mt-1 uppercase tracking-widest font-bold">Concept Reference</p>
                        </div>
                      </div>
                      <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                          <h5 className="text-[10px] font-bold uppercase tracking-widest text-black/30">Hồ sơ nhận dạng</h5>
                          <p className="text-sm text-black/60 leading-relaxed italic">"{char.description}"</p>
                        </div>
                        <Button 
                          className="w-full bg-black hover:bg-black/80 text-white rounded-2xl py-6 font-bold"
                          onClick={() => handleGenerateCharacterConcept(char.id, char.name, char.description)}
                          disabled={generatingCharacters[char.id]}
                        >
                          {generatingCharacters[char.id] ? (
                            <Loader2 size={16} className="animate-spin mr-2" />
                          ) : (
                            <Sparkles size={16} className="mr-2" />
                          )}
                          {char.imageUrl ? "Cập nhật Concept Art" : "Tạo Concept Art tham chiếu"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="script" className="mt-0 animate-in fade-in duration-500">
              <Card className="border-none shadow-xl shadow-black/5 bg-white">
                <CardContent className="p-8">
                  <div className="prose prose-slate max-w-none">
                    <h3 className="text-2xl font-bold mb-6">Hướng dẫn viết kịch bản</h3>
                    <p className="text-black/60 leading-relaxed">
                      Để đạt kết quả tốt nhất, hãy phân chia kịch bản theo các cảnh (SCENE). 
                      Mỗi cảnh nên có mô tả bối cảnh và các hành động cụ thể. AI sẽ tự động nhận diện 
                      các thay đổi về góc máy và hành động để chia nhỏ thành các khung hình (Shots).
                    </p>
                    <div className="mt-8 p-6 bg-black/[0.02] rounded-2xl border border-black/5">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <ChevronRight size={18} className="text-orange-500" />
                        Ví dụ định dạng:
                      </h4>
                      <pre className="text-xs font-mono text-black/70 overflow-x-auto">
{`SCENE 1: KHU RỪNG CỔ THỤ - NGÀY
Một cậu bé đang chạy trốn khỏi một bóng đen.
Cậu bé vấp ngã. Bóng đen tiến lại gần.
Cậu bé nhắm mắt lại. Một ánh sáng rực rỡ xuất hiện.`}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="storyboard" className="mt-0 space-y-8">
              {!analysis ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-black/[0.02] rounded-3xl border-2 border-dashed border-black/10">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <LayoutGrid size={32} className="text-black/20" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Chưa có Storyboard</h3>
                    <p className="text-sm text-black/40">Hãy nhấn "Phân tích" để tạo storyboard từ kịch bản của bạn.</p>
                  </div>
                </div>
              ) : (
                analysis.scenes.map((scene, sIdx) => (
                  <div key={scene.id} className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold">
                        {sIdx + 1}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{scene.title}</h3>
                        <p className="text-sm text-black/50">{scene.description}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {scene.shots.map((shot, shIdx) => (
                        <Card key={shot.id} className="group border-none shadow-lg shadow-black/5 bg-white overflow-hidden hover:shadow-xl transition-all duration-300">
                          <div className="aspect-video bg-black/5 relative overflow-hidden">
                            {shot.imageUrl ? (
                              <img 
                                src={shot.imageUrl} 
                                alt={shot.description} 
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                                {generatingImages[shot.id] ? (
                                  <>
                                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                                    <p className="text-xs font-medium text-orange-600 animate-pulse">AI đang vẽ...</p>
                                  </>
                                ) : (
                                  <>
                                    <ImageIcon size={32} className="text-black/10" />
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="rounded-full border-black/10 hover:bg-black hover:text-white"
                                      onClick={() => handleGenerateImage(shot.id, shot.description, shot.cameraAngle)}
                                    >
                                      Tạo hình ảnh AI
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}
                            <div className="absolute top-3 left-3 flex gap-2">
                              <Badge className="bg-black/80 text-white border-none backdrop-blur-md">
                                Khung hình {shIdx + 1}
                              </Badge>
                              {shot.videoUrl && (
                                <Badge className="bg-indigo-600 text-white border-none backdrop-blur-md">
                                  AI Video
                                </Badge>
                              )}
                            </div>
                            <div className="absolute bottom-3 right-3">
                              <Badge variant="secondary" className="bg-white/90 text-black border-none backdrop-blur-md">
                                {shot.cameraAngle}
                              </Badge>
                            </div>
                          </div>
                          <CardContent className="p-4 space-y-3">
                            <p className="text-sm font-medium leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">
                              {shot.description}
                            </p>
                            {shot.dialogue && (
                              <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                                <p className="text-xs italic text-orange-800">"{shot.dialogue}"</p>
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-black/30">
                                Thời lượng: {shot.duration}s
                              </span>
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleGenerateImage(shot.id, shot.description, shot.cameraAngle)}
                                >
                                  <RefreshCw size={14} />
                                </Button>
                                {shot.imageUrl && (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className={cn(
                                        "h-8 w-8 rounded-full transition-all",
                                        shot.videoUrl ? "text-indigo-600 bg-indigo-50 opacity-100" : "opacity-0 group-hover:opacity-100"
                                      )}
                                      onClick={() => handleGenerateVideo(shot.id, shot.description, shot.imageUrl)}
                                      disabled={generatingVideos[shot.id]}
                                    >
                                      {generatingVideos[shot.id] ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={() => handleDownloadImage(shot.videoUrl || shot.imageUrl!, `Shot-${shIdx + 1}.${shot.videoUrl ? 'mp4' : 'png'}`)}
                                    >
                                      <Download size={14} />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    <Separator className="my-8 bg-black/5" />
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="animatic" className="mt-0">
              {!analysis ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-black/[0.02] rounded-3xl border-2 border-dashed border-black/10">
                  <Film size={32} className="text-black/20" />
                  <p className="text-sm text-black/40">Vui lòng phân tích kịch bản trước.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <Card className="border-none shadow-2xl shadow-black/10 bg-black overflow-hidden aspect-video relative group">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={allShots[currentShotIndex]?.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full h-full"
                      >
                        {allShots[currentShotIndex]?.videoUrl ? (
                          <video 
                            src={allShots[currentShotIndex].videoUrl} 
                            className="w-full h-full object-cover"
                            autoPlay
                            loop={!isPlaying}
                            muted
                            playsInline
                          />
                        ) : allShots[currentShotIndex]?.imageUrl ? (
                          <img 
                            src={allShots[currentShotIndex].imageUrl} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white/20">
                            <ImageIcon size={64} />
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Player Overlays */}
                    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-white">
                          <div>
                            <h4 className="text-lg font-bold">Khung hình {currentShotIndex + 1} / {allShots.length}</h4>
                            <p className="text-sm text-white/60">{allShots[currentShotIndex]?.cameraAngle}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setCurrentShotIndex(Math.max(0, currentShotIndex - 1))}>
                              <ChevronLeft size={24} />
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="icon" 
                              className="h-14 w-14 rounded-full bg-white text-black hover:bg-white/90 shadow-xl"
                              onClick={togglePlay}
                            >
                              {isPlaying ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setCurrentShotIndex(Math.min(allShots.length - 1, currentShotIndex + 1))}>
                              <ChevronRight size={24} />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-orange-500"
                            initial={{ width: "0%" }}
                            animate={{ width: `${((currentShotIndex + 1) / allShots.length) * 100}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Dialogue Overlay */}
                    {allShots[currentShotIndex]?.dialogue && (
                      <div className="absolute top-8 inset-x-0 flex justify-center px-12">
                        <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-center">
                          <p className="text-white text-lg font-medium italic">
                            "{allShots[currentShotIndex].dialogue}"
                          </p>
                        </div>
                      </div>
                    )}
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-none shadow-lg shadow-black/5 bg-white p-6">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-black/30 mb-4">Thông tin Shot</h5>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{allShots[currentShotIndex]?.description}</p>
                        <Badge variant="outline" className="border-black/10">{allShots[currentShotIndex]?.duration} giây</Badge>
                      </div>
                    </Card>
                    
                    <Card className="md:col-span-2 border-none shadow-lg shadow-black/5 bg-white p-2">
                      <ScrollArea className="w-full whitespace-nowrap rounded-xl">
                        <div className="flex p-4 gap-4">
                          {allShots.map((shot, idx) => (
                            <button
                              key={shot.id}
                              onClick={() => setCurrentShotIndex(idx)}
                              className={cn(
                                "flex-none w-32 aspect-video rounded-lg overflow-hidden border-2 transition-all",
                                currentShotIndex === idx ? "border-orange-500 scale-105 shadow-lg" : "border-transparent opacity-50 hover:opacity-100"
                              )}
                            >
                              {shot.imageUrl ? (
                                <img src={shot.imageUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full bg-black/5 flex items-center justify-center">
                                  <ImageIcon size={16} className="text-black/20" />
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </Card>
                  </div>
                </div>
              )}
            </TabsContent>
            </div>
          </Tabs>
        )}
      </main>

      {/* Cinematic Footer */}
      <footer className="mt-40 border-t border-black/[0.03] bg-white relative overflow-hidden py-20 px-6">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] -mr-64 -mt-64" />
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 relative z-10">
          <div className="md:col-span-4 space-y-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                <Clapperboard size={16} />
              </div>
              <span className="text-lg font-display font-black tracking-tighter uppercase">AnimaticAI</span>
            </div>
            <p className="text-sm text-black/50 leading-relaxed font-medium">
              Nền tảng trí tuệ nhân tạo thế hệ mới, giúp hiện thực hóa ý tưởng điện ảnh của bạn từ con chữ sang hình ảnh chuyển động chuyên nghiệp.
            </p>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-colors cursor-pointer">
                <Play size={14} />
              </div>
              <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-colors cursor-pointer">
                <Sparkles size={14} />
              </div>
              <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-orange-500 hover:text-white transition-colors cursor-pointer">
                <LayoutGrid size={14} />
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-4">
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-black/30">Nền tảng</h5>
            <ul className="space-y-3 text-sm font-semibold text-black/60">
              <li className="hover:text-orange-500 cursor-pointer transition-colors">Tính năng</li>
              <li className="hover:text-orange-500 cursor-pointer transition-colors">Mô hình AI</li>
              <li className="hover:text-orange-500 cursor-pointer transition-colors">Bảng giá</li>
              <li className="hover:text-orange-500 cursor-pointer transition-colors">Showcase</li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-4">
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-black/30">Hỗ trợ</h5>
            <ul className="space-y-3 text-sm font-semibold text-black/60">
              <li className="hover:text-orange-500 cursor-pointer transition-colors">Tài liệu</li>
              <li className="hover:text-orange-500 cursor-pointer transition-colors">Cộng đồng</li>
              <li className="hover:text-orange-500 cursor-pointer transition-colors">Trạng thái</li>
              <li className="hover:text-orange-500 cursor-pointer transition-colors">Liên hệ</li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-6">
            <h5 className="text-[10px] font-bold uppercase tracking-widest text-black/30">Đăng ký bản tin Studio</h5>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email của bạn..." 
                className="flex-1 bg-black/[0.02] border-none rounded-xl px-4 text-sm font-medium focus:ring-1 focus:ring-orange-500 outline-none"
              />
              <Button className="rounded-xl bg-black hover:bg-black/80 font-bold text-xs uppercase tracking-widest">
                Gửi
              </Button>
            </div>
            <p className="text-[10px] text-black/40 font-medium">
              Bằng cách tham gia, bạn đồng ý với các Điều khoản & Chính sách quyền riêng tư của chúng tôi.
            </p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-black/[0.03] flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-black/20">
          <span>AnimaticAI © 2026 Studio. All rights reserved.</span>
          <div className="flex gap-6">
            <span className="hover:text-black cursor-pointer transition-colors">Quyền riêng tư</span>
            <span className="hover:text-black cursor-pointer transition-colors">Điều khoản</span>
            <span className="hover:text-black cursor-pointer transition-colors">Cookie</span>
          </div>
        </div>
      </footer>

      {/* Hidden Canvas for Video Export */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

