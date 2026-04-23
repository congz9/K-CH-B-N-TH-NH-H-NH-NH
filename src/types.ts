export interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
}

export interface Shot {
  id: string;
  description: string;
  cameraAngle: string;
  dialogue?: string;
  duration: number;
  imageUrl?: string;
  videoUrl?: string;
}

export interface Scene {
  id: string;
  title: string;
  description: string;
  shots: Shot[];
}

export interface Prop {
  id: string;
  name: string;
  description: string;
}

export interface ScriptAnalysis {
  scenes: Scene[];
  characters: Character[];
  props?: Prop[];
}
