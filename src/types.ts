export interface AttributeSlot {
  value: string;
  imageUrl?: string;
}

export interface CustomAttributeSlot extends AttributeSlot {
  id: string;
  label: string;
}

export interface CharacterAttributes {
  hair?: AttributeSlot | string;
  clothingTop?: AttributeSlot | string;
  clothingBottom?: AttributeSlot | string;
  shoes?: AttributeSlot | string;
  accessories?: AttributeSlot | string;
  customSlots?: CustomAttributeSlot[];
}

export interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  imageHistory?: string[];
  historyIndex?: number;
  attributes?: CharacterAttributes;
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
