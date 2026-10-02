export interface Skill {
  id: number;
  name: string;
  category: string;
  displayOrder: number;
  /** Highlighted on the home page. */
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SkillInput = Omit<Skill, 'id' | 'createdAt' | 'updatedAt'>;

/** Skills grouped for display, e.g. { category: 'Backend', skills: [...] }. */
export interface SkillGroup {
  category: string;
  skills: Skill[];
}
