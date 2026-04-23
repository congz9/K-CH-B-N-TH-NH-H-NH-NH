import { GoogleGenAI, Type } from "@google/genai";
import { ScriptAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 10): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || String(error);
      if (
        errorMessage.includes("429") || 
        error?.status === 429 || 
        errorMessage.includes("RESOURCE_EXHAUSTED") || 
        errorMessage.includes("Quota exceeded") ||
        errorMessage.includes("rate limit")
      ) {
        const delay = Math.pow(2, i) * 3000;
        console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Handle 403 Permission Denied by mentioning the likely cause
      if (errorMessage.includes("403") || errorMessage.includes("PERMISSION_DENIED")) {
        console.error("403 Permission Denied for Gemini Model:", errorMessage);
        throw new Error("403_PERMISSION_DENIED");
      }
      
      throw error;
    }
  }
  throw lastError;
}

export async function analyzeScript(script: string, model: string = "gemini-3-flash-preview"): Promise<ScriptAnalysis> {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: model,
      contents: `Phân tích kịch bản hoạt hình sau đây và trích xuất các cảnh (scenes), khung hình (shots), nhân vật (characters), và đạo cụ (props). 
      
      YÊU CẦU CỰC KỲ QUAN TRỌNG VỀ TÍNH ĐỒNG NHẤT (VISUAL CONTINUITY):
      - NHÂN VẬT: Tạo ra một "Mô tả nhận dạng" (Identity Description) cố định cho mỗi nhân vật. Mô tả này PHẢI bao gồm chi tiết về: kiểu tóc, màu mắt, bộ trang phục cụ thể (ví dụ: áo khoác da màu đỏ, quần jean xanh), và các phụ kiện không thay đổi.
      - BỐI CẢNH (SCENE DESCRIPTION): Với mỗi cảnh, hãy mô tả môi trường xung quanh một cách chi tiết (ví dụ: phòng thí nghiệm u tối với các ống nghiệm xanh, thành phố tương lai đầy ánh đèn neon). Mô tả này sẽ được dùng làm nền tảng cho mọi khung hình trong cảnh đó.
      - KHUNG HÌNH (SHOT): Khi mô tả khung hình, PHẢI nhắc lại tên nhân vật và hành động của họ, đảm bảo họ vẫn đang ở trong bối cảnh của cảnh đó và mặc bộ đồ đã quy định.
      
      Mục tiêu: Đảm bảo khi AI tạo ảnh cho Shot 1 và Shot 5 của cùng một nhân vật trong cùng một cảnh, họ phải trông như cùng một người ở cùng một nơi.
      
      Kịch bản:
      ${script}
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  shots: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        description: { type: Type.STRING },
                        cameraAngle: { type: Type.STRING },
                        dialogue: { type: Type.STRING },
                        duration: { type: Type.NUMBER },
                      },
                      required: ["id", "description", "cameraAngle", "duration"],
                    },
                  },
                },
                required: ["id", "title", "description", "shots"],
              },
            },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["id", "name", "description"],
              },
            },
            props: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["id", "name", "description"],
              },
            },
          },
          required: ["scenes", "characters", "props"],
        },
      },
    });

    try {
      return JSON.parse(response.text || "{}") as ScriptAnalysis;
    } catch (error) {
      console.error("Failed to parse script analysis:", error);
      throw new Error("Failed to analyze script. Please try again.");
    }
  });
}

export async function generateCharacterConcept(
  name: string,
  description: string,
  style: string = "Sketch",
  model: string = "gemini-2.5-flash-image"
): Promise<string> {
  try {
    return await withRetry(async () => {
      let stylePrompt = "";
      switch (style) {
        case "2D Animation":
          stylePrompt = "Clean 2D vector animation style, flat colors, modern look, high quality digital art, character concept sheet.";
          break;
        case "3D Render":
          stylePrompt = "High-quality 3D animation render, Pixar style, soft lighting, detailed textures, character concept art.";
          break;
        case "Anime":
          stylePrompt = "Classic Japanese anime style, hand-drawn look, vibrant colors, Studio Ghibli inspired, character design sheet.";
          break;
        case "Cinematic Concept Art":
          stylePrompt = "Epic cinematic concept art, dramatic lighting, detailed environment, digital painting, character design.";
          break;
        default:
          stylePrompt = "Professional character design sketch, clean lines, white background, charcoal pencil look.";
      }

      if (model.startsWith("imagen")) {
        const prompt = `CHARACTER DESIGN SHEET. Name: ${name}. Description: ${description}. Style: ${stylePrompt}. Clean background, full body.`;
        const response = await ai.models.generateImages({
          model: model,
          prompt: prompt.substring(0, 1000),
          config: {
            numberOfImages: 1,
            outputMimeType: "image/jpeg",
            aspectRatio: "1:1"
          }
        });
        const base64 = response.generatedImages?.[0]?.image?.imageBytes;
        if (base64) {
          return `data:image/jpeg;base64,${base64}`;
        }
        throw new Error("Không thể tạo ảnh từ Imagen");
      }

      const config: any = {};
      if (model === "gemini-3.1-flash-image-preview") {
        config.imageConfig = {
          aspectRatio: "16:9",
          imageSize: "2K"
        };
      }

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [{
            text: `STRICT CHARACTER DESIGN SHEET.
            
            Character Name: ${name}. 
            Physical Description: ${description}. 
            
            Style: ${stylePrompt}. 
            
            INSTRUCTIONS:
            1. Draw a clear, full-body character design sheet.
            2. If the description says "robot", "mechanical", or "non-human", do NOT draw a human silhouette or a person in a suit. It MUST be a literal robot/creature.
            3. Use a neutral, plain background (preferably white or light grey).
            4. Focus on visual clarity and consistent features.
            5. Masterpiece quality, highly detailed.`
          }]
        },
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
      if (part?.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
      return `https://picsum.photos/seed/${encodeURIComponent(name)}/512/512`;
    });
  } catch (error: any) {
    if (error?.message === "403_PERMISSION_DENIED" && model !== "gemini-2.5-flash-image") {
      console.warn(`Falling back from ${model} to gemini-2.5-flash-image due to 403 error.`);
      return generateCharacterConcept(name, description, style, "gemini-2.5-flash-image");
    }
    throw error;
  }
}

export async function generateVideo(
  prompt: string, 
  aspectRatio: "16:9" | "9:16" = "16:9",
  imageUrl?: string
): Promise<string> {
  // Use VEO for high quality video generation
  // Create a new instance right before call as per skill guidance
  const videoAi = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });
  
  return withRetry(async () => {
    let imagePart: any = undefined;
    if (imageUrl && imageUrl.startsWith("data:")) {
      const parts = imageUrl.split(",");
      const mimeType = parts[0].split(":")[1].split(";")[0];
      const data = parts[1];
      imagePart = {
        imageBytes: data,
        mimeType: mimeType
      };
    }

    let operation = await videoAi.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt,
      image: imagePart,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 8000));
      try {
        operation = await videoAi.operations.getVideosOperation({ operation: operation });
      } catch (error: any) {
        if (error?.message?.includes("Requested entity was not found")) {
          throw new Error("API_KEY_RESET_REQUIRED");
        }
        throw error;
      }
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed - no URI returned");

    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
    const response = await fetch(downloadLink, {
      method: "GET",
      headers: {
        "x-goog-api-key": apiKey,
      },
    });

    if (!response.ok) throw new Error(`Failed to download video: ${response.statusText}`);
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  });
}

export async function generateStoryboardImage(
  description: string, 
  cameraAngle: string, 
  style: string = "Sketch",
  referenceImage?: string,
  characterDescriptions?: string, // Global character context
  propsDescriptions?: string, // Global props/vehicles context
  characterImages?: string[], // Character reference images
  model: string = "gemini-2.5-flash-image",
  isHighFidelity: boolean = false
): Promise<string> {
  try {
    return await withRetry(async () => {
    let stylePrompt = "";
    const qualityBoost = isHighFidelity ? ", ultra high resolution, cinematic lighting, masterpiece, 8k, highly detailed textures" : "";

    switch (style) {
      case "2D Animation":
        stylePrompt = `Clean 2D vector animation style, flat colors, modern look, high quality digital art, consistent character design${qualityBoost}.`;
        break;
      case "3D Render":
        stylePrompt = `High-quality 3D animation render, Pixar style, soft lighting, detailed textures, octane render, 4k, consistent character features${qualityBoost}.`;
        break;
      case "Anime":
        stylePrompt = `Classic Japanese anime style, hand-drawn look, vibrant colors, Studio Ghibli inspired, high detail, consistent character appearance${qualityBoost}.`;
        break;
      case "Cinematic Concept Art":
        stylePrompt = `Epic cinematic concept art, dramatic lighting, detailed environment, digital painting, masterpiece, consistent character portrayal${qualityBoost}.`;
        break;
      case "Cyberpunk":
        stylePrompt = `Cyberpunk aesthetic, neon lights, rainy night, futuristic tech, high contrast, synthwave colors, consistent character details${qualityBoost}.`;
        break;
      case "Watercolor":
        stylePrompt = `Soft watercolor painting style, artistic brush strokes, gentle colors, dreamy atmosphere, traditional media look, consistent character silhouette${qualityBoost}.`;
        break;
      case "Reference":
        stylePrompt = `Follow the visual style, color palette, and artistic technique of the provided reference image strictly. Maintain character consistency${qualityBoost}.`;
        break;
      default:
        stylePrompt = `Professional black and white storyboard sketch, clean lines, cinematic composition, charcoal pencil look, consistent character proportions${qualityBoost}.`;
    }

    if (model.startsWith("imagen")) {
      const prompt = `Storyboard shot. ${description}. Camera: ${cameraAngle}. Style: ${stylePrompt}. Context: ${characterDescriptions} ${propsDescriptions}`;
      const response = await ai.models.generateImages({
        model: model,
        prompt: prompt.substring(0, 1000),
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "16:9",
          // Note: In production Vertex AI environments, you can specify safety settings and higher resolution models here
        }
      });
      const base64 = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64) {
        return `data:image/jpeg;base64,${base64}`;
      }
      throw new Error("Không thể tạo ảnh từ Imagen");
    }

    const parts: any[] = [
      {
        text: `YÊU CẦU ĐỒNG NHẤT HÌNH ẢNH TUYỆT ĐỐI (STRICT VISUAL CONTINUITY).
        
        Bạn là một nghệ sĩ vẽ storyboard chuyên nghiệp. Mục tiêu cao nhất là giữ nguyên hình dáng nhân vật, trang phục, phương tiện và bối cảnh xuyên suốt các khung hình.
        
        NGUỒN THÔNG TIN NHÂN VẬT & ĐẠO CỤ:
        ${characterDescriptions || "Không có mô tả cụ thể."}
        ${propsDescriptions || ""}
        
        MÔ TẢ KHUNG HÌNH (SHOT):
        - Nội dung: ${description}
        - Góc máy: ${cameraAngle}
        - Phong cách: ${stylePrompt}
        
        CHỈ THỊ QUAN TRỌNG:
        1. NGOẠI HÌNH NHÂN VẬT: Phải khớp 100% với mô tả trên (kiểu tóc, quần áo, đặc điểm nhận dạng).
        2. PHƯƠNG TIỆN/ĐẠO CỤ: Nếu bối cảnh nói có xe thể thao, không được vẽ xe cổ điển. Nếu có mũ bảo hiểm, phải đội mũ xuyên suốt trừ khi có lệnh bỏ ra.
        3. BỐI CẢNH (BACKGROUND): Đảm bảo không gian môi trường đồng nhất với các chi tiết đã nêu trong cảnh.
        4. TÍNH LIÊN TỤC: Không tự ý thay đổi thiết kế nhân vật khi thay đổi góc máy.`
      }
    ];

    if (characterImages && characterImages.length > 0) {
      characterImages.forEach((img, idx) => {
        parts.push({
          inlineData: {
            data: img.split(',')[1] || img,
            mimeType: "image/jpeg"
          }
        });
        parts.push({ text: `Reference image for character ${idx + 1}` });
      });
    }

    if (referenceImage) {
      parts.push({
        inlineData: {
          data: referenceImage.split(',')[1] || referenceImage,
          mimeType: "image/jpeg"
        }
      });
    }

    const config: any = {};
    if (model === "gemini-3.1-flash-image-preview") {
      config.imageConfig = {
        aspectRatio: "16:9",
        imageSize: "2K"
      };
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: Object.keys(config).length > 0 ? config : undefined,
    });

    const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    if (part?.inlineData?.data) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    
    return `https://picsum.photos/seed/${encodeURIComponent(description)}/800/450`;
    });
  } catch (error: any) {
    if (error?.message === "403_PERMISSION_DENIED" && model !== "gemini-2.5-flash-image") {
      console.warn(`Falling back from ${model} to gemini-2.5-flash-image due to 403 error.`);
      return generateStoryboardImage(description, cameraAngle, style, referenceImage, characterDescriptions, propsDescriptions, characterImages, "gemini-2.5-flash-image");
    }
    throw error;
  }
}