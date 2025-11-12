import api from '../lib/api';

type ApiUserProfile = {
  id: string;
  email: string;
  display_name: string;
  bio?: string | null;
  interests?: string[] | null;
  photos?: string[] | null;
  pronouns?: string | null;
  location?: string | null;
};

type ApiPhotoUploadResponse = {
  url: string;
  photos: string[];
};

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  bio?: string;
  interests?: string[];
  photos?: string[];
  pronouns?: string;
  location?: string;
};

export type UserProfileUpdateInput = Partial<Pick<UserProfile, 'displayName' | 'bio' | 'interests' | 'photos' | 'pronouns' | 'location'>>;

function normalizeProfile(payload: ApiUserProfile): UserProfile {
  return {
    id: payload.id,
    email: payload.email,
    displayName: payload.display_name,
    bio: payload.bio ?? undefined,
    interests: payload.interests ?? undefined,
    photos: payload.photos ?? undefined,
    pronouns: payload.pronouns ?? undefined,
    location: payload.location ?? undefined,
  };
}

function serializeUpdate(payload: UserProfileUpdateInput) {
  return {
    display_name: payload.displayName,
    bio: payload.bio,
    interests: payload.interests,
    photos: payload.photos,
    pronouns: payload.pronouns,
    location: payload.location,
  };
}

export const usersService = {
  async getProfile(): Promise<UserProfile> {
    const { data } = await api.get<ApiUserProfile>('/users/me');
    return normalizeProfile(data);
  },

  async updateProfile(payload: UserProfileUpdateInput): Promise<UserProfile> {
    const { data } = await api.patch<ApiUserProfile>('/users/me', serializeUpdate(payload));
    return normalizeProfile(data);
  },

  async uploadPhoto(file: File): Promise<ApiPhotoUploadResponse> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<ApiPhotoUploadResponse>('/users/me/photos', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async lookup(email: string): Promise<UserProfile> {
    const { data } = await api.get<ApiUserProfile>('/users/lookup', { params: { email } });
    return normalizeProfile(data);
  },

  async createProfile(payload: { email: string; displayName: string; password?: string }): Promise<UserProfile> {
    const { data } = await api.post<ApiUserProfile>('/users', {
      email: payload.email,
      display_name: payload.displayName,
      password: payload.password,
    });
    return normalizeProfile(data);
  },
};

export { normalizeProfile as normalizeUserProfile };
