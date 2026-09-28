export interface Project {
  id: number;
  title: string;
  slug: string;
  summary: string;
  description: string;
  githubUrl: string;
  liveUrl: string;
  imageUrl: string;
  isFeatured: boolean;
  displayOrder: number;
  technologies: string[];
  createdAt: string;
  updatedAt: string;
}

/** Body for create/update. Update replaces every field. */
export type ProjectInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;
