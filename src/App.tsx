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
  User as UserIcon,
  Pencil,
  UploadCloud,
  RotateCcw,
  RotateCw,
  Check,
  Scissors,
  Shirt,
  ShoppingBag,
  Footprints,
  Glasses,
  Plus,
  TextCursorInput,
  Settings,
  Key
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { analyzeScript, generateStoryboardImage, generateCharacterConcept, generateVideo } from "./services/geminiService";
import { Scene, Shot, ScriptAnalysis, Character, CharacterAttributes, CustomAttributeSlot } from "./types";
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
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  
  // Character Editing State
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [editCharDesc, setEditCharDesc] = useState<string>("");
  const characterFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCharId, setUploadingCharId] = useState<string | null>(null);
  
  // Storyboard Pagination
  const [currentScenePage, setCurrentScenePage] = useState(0);
  
  // Animatic Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);
  const [allShots, setAllShots] = useState<Shot[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const playerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Custom API Key Settings
  const [customApiKey, setCustomApiKey] = useState("");

  useEffect(() => {
    const savedKey = localStorage.getItem("customAIApiKey");
    if (savedKey) setCustomApiKey(savedKey);
  }, []);

  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    localStorage.setItem("customAIApiKey", key);
  };

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
        true, // Enable High Fidelity / Production Mode
        aspectRatio
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

  const handleGenerateCharacterConcept = async (charId: string, name: string, description: string, referenceImages?: string[]) => {
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
        imageModel,
        referenceImages
      );
      setAnalysis(prev => {
        if (!prev) return null;
        return {
          ...prev,
          characters: prev.characters.map(c => {
            if (c.id === charId) {
              const newHistory = [...(c.imageHistory || []), imageUrl];
              return { 
                ...c, 
                imageUrl, 
                imageHistory: newHistory,
                historyIndex: newHistory.length - 1
              };
            }
            return c;
          })
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

  const handleUpdateCharacterAttributeText = (charId: string, attrKey: keyof CharacterAttributes, value: string) => {
    setAnalysis(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characters: prev.characters.map(c => {
          if (c.id === charId) {
            const currentAttr = c.attributes?.[attrKey] as any;
            const imageUrl = typeof currentAttr === 'object' ? currentAttr.imageUrl : undefined;
            return {
              ...c,
              attributes: {
                ...(c.attributes || {}),
                [attrKey]: { value, imageUrl }
              }
            };
          }
          return c;
        })
      };
    });
  };

  const handleAttributeImageUpload = (charId: string, attrKey: keyof CharacterAttributes, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        let updatedChar: Character | undefined;

        setAnalysis(prev => {
          if (!prev) return null;
          return {
            ...prev,
            characters: prev.characters.map(c => {
              if (c.id === charId) {
                const currentAttr = c.attributes?.[attrKey] as any;
                const value = currentAttr?.value || (typeof currentAttr === 'string' ? currentAttr : '');
                
                updatedChar = {
                  ...c,
                  attributes: {
                    ...(c.attributes || {}),
                    [attrKey]: { value, imageUrl }
                  }
                };
                return updatedChar;
              }
              return c;
            })
          };
        });

        // Trigger concept generation combining the new item with previous character look
        if (updatedChar) {
           setTimeout(() => {
             handleGenerateCharacterConceptWithAttributes(updatedChar!);
           }, 500);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCustomAttributeSlot = (charId: string) => {
    setAnalysis(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characters: prev.characters.map(c => {
          if (c.id === charId) {
            const newSlotId = `custom-${Date.now()}`;
            return {
              ...c,
              attributes: {
                ...(c.attributes || {}),
                customSlots: [
                  ...(c.attributes?.customSlots || []),
                  { id: newSlotId, label: 'Món đồ mới', value: '' }
                ]
              }
            };
          }
          return c;
        })
      };
    });
  };

  const handleUpdateCustomAttributeText = (charId: string, slotId: string, value: string) => {
    setAnalysis(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characters: prev.characters.map(c => {
          if (c.id === charId && c.attributes?.customSlots) {
            return {
              ...c,
              attributes: {
                ...c.attributes,
                customSlots: c.attributes.customSlots.map(slot => 
                  slot.id === slotId ? { ...slot, value } : slot
                )
              }
            };
          }
          return c;
        })
      };
    });
  };

  const handleUpdateCustomAttributeLabel = (charId: string, slotId: string, label: string) => {
    setAnalysis(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characters: prev.characters.map(c => {
          if (c.id === charId && c.attributes?.customSlots) {
            return {
              ...c,
              attributes: {
                ...c.attributes,
                customSlots: c.attributes.customSlots.map(slot => 
                  slot.id === slotId ? { ...slot, label } : slot
                )
              }
            };
          }
          return c;
        })
      };
    });
  };

  const handleCustomAttributeImageUpload = (charId: string, slotId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        let updatedChar: Character | undefined;

        setAnalysis(prev => {
          if (!prev) return null;
          return {
            ...prev,
            characters: prev.characters.map(c => {
              if (c.id === charId && c.attributes?.customSlots) {
                updatedChar = {
                  ...c,
                  attributes: {
                    ...c.attributes,
                    customSlots: c.attributes.customSlots.map(slot => 
                      slot.id === slotId ? { ...slot, imageUrl } : slot
                    )
                  }
                };
                return updatedChar;
              }
              return c;
            })
          };
        });

        // Trigger concept generation combining the new item with previous character look
        if (updatedChar) {
           setTimeout(() => {
             handleGenerateCharacterConceptWithAttributes(updatedChar!);
           }, 500);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateCharacterConceptWithAttributes = async (char: Character) => {
    const getVal = (attr: any) => attr?.value || (typeof attr === 'string' ? attr : '');
    const getImg = (attr: any) => attr?.imageUrl;

    const baseDescriptions = [
      char.description,
      getVal(char.attributes?.hair) ? `Tóc/Khuôn mặt: ${getVal(char.attributes?.hair)}` : '',
      getVal(char.attributes?.clothingTop) ? `Áo/Thân trên: ${getVal(char.attributes?.clothingTop)}` : '',
      getVal(char.attributes?.clothingBottom) ? `Quần/Thân dưới: ${getVal(char.attributes?.clothingBottom)}` : '',
      getVal(char.attributes?.shoes) ? `Giày dép: ${getVal(char.attributes?.shoes)}` : '',
      getVal(char.attributes?.accessories) ? `Phụ kiện: ${getVal(char.attributes?.accessories)}` : ''
    ];

    if (char.attributes?.customSlots && char.attributes.customSlots.length > 0) {
      char.attributes.customSlots.forEach(slot => {
        if (slot.value || slot.label) {
           baseDescriptions.push(`${slot.label}: ${slot.value}`);
        }
      });
    }

    const combinedDescription = baseDescriptions.filter(Boolean).join('. ');
    
    // Gather all reference images from slots plus the current character image
    const referenceImages: string[] = [];
    if (char.imageUrl) {
        referenceImages.push(char.imageUrl); // Current body look
    }
    const attrs: (keyof CharacterAttributes)[] = ['hair', 'clothingTop', 'clothingBottom', 'shoes', 'accessories'];
    attrs.forEach(key => {
        const img = getImg(char.attributes?.[key]);
        if (img) referenceImages.push(img);
    });

    if (char.attributes?.customSlots) {
       char.attributes.customSlots.forEach(slot => {
          if (slot.imageUrl) {
            referenceImages.push(slot.imageUrl);
          }
       });
    }

    await handleGenerateCharacterConcept(char.id, char.name, combinedDescription, referenceImages);
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
    setEditingCharId(null);
  };

  const handleCharacterImageUpload = (charId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageUrl = reader.result as string;
        setAnalysis(prev => {
          if (!prev) return null;
          return {
            ...prev,
            characters: prev.characters.map(c => {
              if (c.id === charId) {
                const newHistory = [...(c.imageHistory || []), imageUrl];
                return { 
                  ...c, 
                  imageUrl, 
                  imageHistory: newHistory,
                  historyIndex: newHistory.length - 1
                };
              }
              return c;
            })
          };
        });
        setUploadingCharId(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNavigateCharacterHistory = (charId: string, direction: 'prev' | 'next') => {
    setAnalysis(prev => {
      if (!prev) return null;
      return {
        ...prev,
        characters: prev.characters.map(c => {
          if (c.id === charId && c.imageHistory && c.historyIndex !== undefined) {
            let newIndex = c.historyIndex;
            if (direction === 'prev' && newIndex > 0) newIndex--;
            if (direction === 'next' && newIndex < c.imageHistory.length - 1) newIndex++;
            return {
              ...c,
              historyIndex: newIndex,
              imageUrl: c.imageHistory[newIndex]
            };
          }
          return c;
        })
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

  const handleResyncAllImages = async () => {
    if (!analysis) return;
    const confirmed = window.confirm("Đồng bộ sẽ tạo lại toàn bộ hình ảnh Storyboard dựa trên Concept nhân vật mới hiện tại. Bạn có chắc chắn không? (Quá trình này có thể tốn thời gian API)");
    if (!confirmed) return;
    
    for (const scene of analysis.scenes) {
      for (const shot of scene.shots) {
        await handleGenerateImage(shot.id, shot.description, shot.cameraAngle);
        await new Promise(resolve => setTimeout(resolve, 3000));
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
          <span className="text-xl font-display font-extrabold tracking-tighter uppercase sm:block hidden">AnimaticAI</span>
        </div>

        <div className="flex items-center gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="rounded-full w-10 h-10 p-0 border border-black/5 hover:bg-black/5">
                <Settings size={18} className="text-black/60" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
              <div className="bg-black/5 p-6 border-b border-black/5">
                <DialogTitle className="text-xl font-display font-bold text-black flex items-center gap-2">
                  <Settings size={20} className="text-orange-500" />
                  Cấu hình Hệ thống
                </DialogTitle>
                <DialogDescription className="mt-1">
                  Tuỳ chỉnh mô hình AI và các thiết lập tài khoản.
                </DialogDescription>
              </div>
              <div className="p-6 space-y-8">
                {/* Model Selection */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-black/50">Mô hình Tạo Ảnh</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {AI_MODELS.map((model) => (
                      <div
                        key={model.id}
                        onClick={() => handleModelChange(model.id)}
                        className={cn(
                          "flex items-center p-3 rounded-2xl border-2 transition-all cursor-pointer group",
                          selectedModel === model.id 
                            ? "border-orange-500 bg-orange-50/50" 
                            : "border-black/5 hover:border-black/10"
                        )}
                      >
                        <div className="text-2xl mr-4">{model.icon}</div>
                        <div className="flex-1">
                          <h5 className="font-bold text-sm">{model.name}</h5>
                          <p className="text-xs text-black/50 mt-0.5">{model.description}</p>
                        </div>
                        {selectedModel === model.id ? (
                           <div className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center">
                              <Check size={12} />
                           </div>
                        ) : (
                           <div className="w-5 h-5 rounded-full border-2 border-black/10 group-hover:border-black/20" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* API Key Config */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-black/50">API Key Tùy Chỉnh (Tùy chọn)</h4>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
                      <Input 
                        type="password" 
                        placeholder="Nhập Google AI Studio API Key..." 
                        className="pl-10 rounded-xl bg-black/5 border-transparent focus-visible:ring-orange-500"
                        value={customApiKey}
                        onChange={(e) => handleSaveApiKey(e.target.value)}
                      />
                    </div>
                    {customApiKey && (
                      <Button variant="ghost" size="sm" onClick={() => handleSaveApiKey("")} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        Xóa
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-black/40 leading-relaxed">
                    Nếu bạn để trống mục này, hệ thống sẽ sử dụng API Key mặc định của ứng dụng. Nhập key của riêng bạn giúp tránh giới hạn quota rate-limit và có thể xuất video Veo.
                  </p>
                </div>

                {/* Account / Auth */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-black/50">Tài khoản</h4>
                  {user ? (
                    <div className="flex items-center gap-4 bg-black/5 p-4 rounded-2xl">
                      <img src={user.photoURL || `https://avatar.vercel.sh/${user.email}`} alt="avatar" className="w-12 h-12 rounded-full shadow-sm" referrerPolicy="no-referrer" />
                      <div className="flex-1">
                         <p className="font-bold">{user.displayName || 'Người dùng'}</p>
                         <p className="text-xs text-black/50">{user.email}</p>
                      </div>
                      <Button onClick={handleLogout} variant="outline" size="sm" className="rounded-full px-4 border-black/10 hover:bg-black/5">
                        Đăng xuất
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center p-6 bg-orange-50 rounded-2xl border border-orange-100 text-center">
                       <UserIcon size={32} className="text-orange-300 mb-2" />
                       <p className="text-sm font-medium text-orange-800 mb-4">Đăng nhập để tự động lưu lịch sử nhân vật và kịch bản lên Cloud.</p>
                       <Button onClick={handleLogin} className="w-full rounded-2xl bg-orange-500 hover:bg-orange-600 font-bold shadow-md shadow-orange-500/20">
                          Đăng nhập bằng Google
                       </Button>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </nav>

      {/* Hero Section (Only if no analysis) */}
      {!analysis && (
        <header className="pt-20 pb-10 px-6 max-w-4xl mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-100 text-[10px] font-bold uppercase tracking-widest">
            <Sparkles size={12} />
            AI-Powered Storyboarding Studio
          </div>
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

              <Separator className="bg-black/[0.03]" />

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-black/30">Tỉ lệ khung hình</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAspectRatio("16:9")}
                    className={cn(
                      "px-4 py-3 rounded-2xl border-2 transition-all font-bold text-xs",
                      aspectRatio === "16:9" 
                        ? "border-orange-500 bg-orange-50 text-orange-700" 
                        : "border-black/5 hover:border-black/10 text-black/60"
                    )}
                  >
                    16:9 (Ngang)
                  </button>
                  <button
                    onClick={() => setAspectRatio("9:16")}
                    className={cn(
                      "px-4 py-3 rounded-2xl border-2 transition-all font-bold text-xs",
                      aspectRatio === "9:16" 
                        ? "border-orange-500 bg-orange-50 text-orange-700" 
                        : "border-black/5 hover:border-black/10 text-black/60"
                    )}
                  >
                    9:16 (Dọc)
                  </button>
                </div>
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
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] font-black uppercase tracking-widest text-black/40 hover:text-black/80 hover:bg-black/5"
                      onClick={handleResyncAllImages}
                    >
                      <RefreshCw size={14} className="mr-1" />
                      Đồng bộ thiết kế
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] font-black uppercase tracking-widest text-orange-600 hover:bg-orange-50"
                      onClick={handleGenerateAllImages}
                    >
                      Tạo tất cả ảnh mới
                    </Button>
                  </>
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
                <div className="grid grid-cols-1 gap-6">
                  {analysis.characters.map((char) => (
                    <Card key={char.id} className="border-none shadow-xl shadow-black/5 bg-white overflow-hidden rounded-3xl group">
                      <div className="flex flex-col lg:flex-row min-h-[400px]">
                        
                        {/* Left Side: Equipment Slots */}
                        <div className="lg:w-2/5 p-6 border-r border-black/5 flex flex-col justify-between bg-black/[0.01]">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xl font-display font-bold text-black">{char.name}</h4>
                            </div>
                            
                            <div className="text-xs text-black/50 italic mb-4">
                              {char.description}
                            </div>
                            
                            <div className="space-y-3">
                              {[
                                { key: 'hair' as keyof CharacterAttributes, icon: Scissors, label: 'Tóc & Khuôn mặt', placeholder: 'Ví dụ: Tóc ngắn ngang vai màu nâu...' },
                                { key: 'clothingTop' as keyof CharacterAttributes, icon: Shirt, label: 'Áo & Bộ đồ', placeholder: 'Ví dụ: Áo hoodie màu vàng...' },
                                { key: 'clothingBottom' as keyof CharacterAttributes, icon: ShoppingBag, label: 'Quần & Váy', placeholder: 'Ví dụ: Quần jean xanh rách...' },
                                { key: 'shoes' as keyof CharacterAttributes, icon: Footprints, label: 'Giày dép', placeholder: 'Ví dụ: Sneaker đỏ...' },
                                { key: 'accessories' as keyof CharacterAttributes, icon: Glasses, label: 'Phụ kiện', placeholder: 'Kính, túi...' },
                              ].map((slot) => {
                                const currentAttr = char.attributes?.[slot.key] as any;
                                const value = currentAttr?.value || (typeof currentAttr === 'string' ? currentAttr : '');
                                const imgUrl = currentAttr?.imageUrl;

                                return (
                                  <div key={slot.key} className="flex gap-3 border rounded-2xl p-2 bg-white shadow-sm shadow-black/5 border-black/5 transition-all focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20">
                                    <div className="relative w-16 h-16 rounded-xl bg-black/5 flex-shrink-0 overflow-hidden border border-black/10 group cursor-pointer hover:bg-black/10 transition-colors">
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        onChange={(e) => handleAttributeImageUpload(char.id, slot.key, e)}
                                      />
                                      {imgUrl ? (
                                        <img src={imgUrl} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-black/20 group-hover:text-black/50">
                                          <UploadCloud size={16} />
                                        </div>
                                      )}
                                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] font-bold text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        THÊM ẢNH
                                      </div>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center">
                                      <div className="flex items-center gap-1.5 text-[10px] text-black/50 font-bold uppercase mb-1">
                                        <slot.icon size={12} /> {slot.label}
                                      </div>
                                      <input 
                                        value={value}
                                        onChange={(e) => handleUpdateCharacterAttributeText(char.id, slot.key, e.target.value)}
                                        placeholder={slot.placeholder}
                                        className="w-full bg-transparent text-sm font-medium focus:outline-none"
                                      />
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Render custom slots */}
                              {char.attributes?.customSlots?.map(customSlot => (
                                <div key={customSlot.id} className="flex gap-3 border rounded-2xl p-2 bg-white shadow-sm shadow-black/5 border-orange-200 transition-all focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 relative group">
                                    {/* Delete slot button (only visible on hover) */}
                                    <button 
                                      onClick={() => {
                                        setAnalysis(prev => {
                                          if(!prev) return null;
                                          return {
                                            ...prev,
                                            characters: prev.characters.map(c => 
                                              c.id === char.id ? {
                                                ...c,
                                                attributes: {
                                                  ...c.attributes,
                                                  customSlots: c.attributes?.customSlots?.filter(cs => cs.id !== customSlot.id)
                                                }
                                              } : c
                                            )
                                          }
                                        })
                                      }}
                                      className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-500 hover:text-white"
                                    >
                                      <X size={12} />
                                    </button>

                                    <div className="relative w-16 h-16 rounded-xl bg-orange-50/50 flex-shrink-0 overflow-hidden border border-orange-100 group/img cursor-pointer hover:bg-orange-100/50 transition-colors">
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        onChange={(e) => handleCustomAttributeImageUpload(char.id, customSlot.id, e)}
                                      />
                                      {customSlot.imageUrl ? (
                                        <img src={customSlot.imageUrl} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-orange-300 group-hover/img:text-orange-500">
                                          <UploadCloud size={16} />
                                        </div>
                                      )}
                                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[8px] font-bold text-center py-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                        THÊM ẢNH
                                      </div>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center space-y-1">
                                      <div className="flex items-center gap-1.5 text-[10px] text-orange-600 font-bold uppercase">
                                        <TextCursorInput size={12} /> 
                                        <input 
                                          value={customSlot.label}
                                          onChange={(e) => handleUpdateCustomAttributeLabel(char.id, customSlot.id, e.target.value)}
                                          placeholder="Tên món đồ (VD: Vũ khí)"
                                          className="bg-transparent border-b border-orange-200 focus:border-orange-500 focus:outline-none placeholder:text-orange-300 max-w-[120px]"
                                        />
                                      </div>
                                      <input 
                                        value={customSlot.value}
                                        onChange={(e) => handleUpdateCustomAttributeText(char.id, customSlot.id, e.target.value)}
                                        placeholder="Mô tả chi tiết..."
                                        className="w-full bg-transparent text-sm font-medium focus:outline-none"
                                      />
                                    </div>
                                </div>
                              ))}

                              {/* Add custom slot button */}
                              <Button 
                                variant="outline" 
                                className="w-full border-dashed border-2 rounded-2xl text-black/50 hover:text-black hover:border-black/20 hover:bg-black/5 mt-2 h-14"
                                onClick={() => handleAddCustomAttributeSlot(char.id)}
                              >
                                <Plus size={16} className="mr-2" /> Thêm phụ kiện khác
                              </Button>
                            </div>
                          </div>
                          
                          <Button 
                            className="w-full bg-black hover:bg-black/90 text-white rounded-2xl py-6 mt-6 font-bold transition-all active:scale-[0.98] shadow-lg shadow-black/10"
                            onClick={() => handleGenerateCharacterConceptWithAttributes(char)}
                            disabled={generatingCharacters[char.id]}
                          >
                            {generatingCharacters[char.id] ? (
                              <Loader2 size={16} className="animate-spin mr-2" />
                            ) : (
                              <Sparkles size={16} className="mr-2 text-orange-400" />
                            )}
                            {char.imageUrl ? "Cập nhật (Reroll)" : "Tạo Concept Art"}
                          </Button>
                        </div>

                        {/* Right Side: Image Preview Preview */}
                        <div className="lg:w-3/5 bg-black/5 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
                          <div className="absolute top-4 right-4 flex gap-2 z-10">
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              id={`upload-${char.id}`}
                              onChange={(e) => {
                                setUploadingCharId(char.id);
                                handleCharacterImageUpload(char.id, e);
                              }}
                            />
                            <label htmlFor={`upload-${char.id}`}>
                              <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white cursor-pointer hover:bg-black/60 transition-colors shadow-sm">
                                {uploadingCharId === char.id ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                              </div>
                            </label>
                          </div>

                          {char.imageHistory && char.imageHistory.length > 0 && (
                            <div className="absolute top-4 left-4 flex gap-2 z-10 bg-black/40 backdrop-blur-md rounded-full p-1.5 shadow-sm">
                              <button 
                                onClick={() => handleNavigateCharacterHistory(char.id, 'prev')}
                                disabled={char.historyIndex === 0}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/20 transition-colors"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <div className="text-white text-xs font-bold self-center px-2">
                                {(char.historyIndex || 0) + 1} / {char.imageHistory.length}
                              </div>
                              <button 
                                onClick={() => handleNavigateCharacterHistory(char.id, 'next')}
                                disabled={char.historyIndex === char.imageHistory.length - 1}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/20 transition-colors"
                              >
                                <RotateCw size={14} />
                              </button>
                            </div>
                          )}

                          {char.imageUrl ? (
                            <div className="w-full relative py-8 px-4 flex items-center justify-center">
                               <img src={char.imageUrl} alt={char.name} className="w-full max-w-full max-h-[600px] object-contain drop-shadow-2xl" />
                               <div className="absolute bottom-4 inset-x-0 text-center">
                                  <Badge variant="secondary" className="bg-black/10 text-black/40 border-none">Character Turnaround Sheet</Badge>
                               </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                              {generatingCharacters[char.id] ? (
                                <Loader2 size={40} className="animate-spin text-orange-500" />
                              ) : (
                                <UserIcon size={56} className="text-black/10" />
                              )}
                              <p className="text-sm text-black/30 font-medium">Chưa có Concept Art</p>
                            </div>
                          )}
                        </div>
                      </div>
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
                <div className="space-y-6">
                  {/* Pagination Controls */}
                  <div className="flex flex-wrap items-center gap-2 mb-6">
                    {analysis.scenes.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentScenePage(idx)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                          currentScenePage === idx 
                            ? "bg-black text-white" 
                            : "bg-black/5 text-black/60 hover:bg-black/10"
                        )}
                      >
                        Trang {idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Render the current scene based on pagination */}
                  {analysis.scenes[currentScenePage] && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold">
                          {currentScenePage + 1}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">{analysis.scenes[currentScenePage].title}</h3>
                          <p className="text-sm text-black/50">{analysis.scenes[currentScenePage].description}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {analysis.scenes[currentScenePage].shots.map((shot, shIdx) => (
                          <Card key={shot.id} className="group border-none shadow-lg shadow-black/5 bg-white overflow-hidden hover:shadow-xl transition-all duration-300">
                            <div className={cn(
                              "bg-black/5 relative overflow-hidden",
                              aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-[16/9]"
                            )}>
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
                  </div>
                )}
                </div>
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

