export type UserRole = "admin" | "user";

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
  allowedLinks?: AllowedLink[];
  usageExpiresAt?: string;
};

export type PlatformId = "panda" | "soop" | "youtube";

export type AllowedLink = {
  id?: string;
  platform: PlatformId;
  url: string;
  createdAt?: string;
};

export type ServiceUser = {
  id: string;
  loginId: string;
  memo: string | null;
  usageExpiresAt: string;
  allowedLinks: AllowedLink[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  createdByAdminId: string;
  profile: UserProfileDetails | null;
};

export type UserProfileDetails = {
  phoneNumber: string | null;
  cashReceiptNumber: string | null;
  businessRegistrationNumber: string | null;
  businessName: string | null;
  representativeName: string | null;
  businessTypeItem: string | null;
  businessAddress: string | null;
  billingEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MyProfile = {
  id: string;
  loginId: string;
  usageExpiresAt: string;
  allowedLinks: AllowedLink[];
  profile: UserProfileDetails | null;
};

export type Administrator = {
  id: string;
  loginId: string;
  createdAt: string;
  lastLoginAt: string | null;
  createdBy: string | null;
};

export type PaymentType = "card" | "bank_transfer" | "cash" | "virtual_account" | "other";

export type UserPayment = {
  id: string;
  userId: string;
  amount: number;
  paymentType: PaymentType;
  bankName: string | null;
  paidAt: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};
