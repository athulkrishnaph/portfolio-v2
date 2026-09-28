export interface SocialLink {
  platform: string;
  url: string;
}

export interface Profile {
  fullName: string;
  headline: string;
  bio: string;
  email: string;
  location: string;
  imageUrl: string;
  resumeUrl: string;
  /** In display order. */
  socialLinks: SocialLink[];
  updatedAt: string;
}

export type ProfileInput = Omit<Profile, 'updatedAt'>;
