import { FormEvent, SVGProps, useEffect, useMemo, useState } from "react";

type UiLang = "ru" | "en";
type AuthStep = "phone" | "otp" | "cloud_password";
type Section = "chats" | "contacts" | "feed" | "search" | "groups";

type User = {
  id: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  bio?: string | null;
  avatarAttachmentId?: string | null;
  locale: "ru" | "en";
  isAdmin: boolean;
  hasCloudPassword: boolean;
  needsOnboarding: boolean;
};

type UserPreview = {
  id: string;
  phone: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarAttachmentId?: string | null;
};

type Chat = {
  id: string;
  type: "PRIVATE" | "GROUP";
  title: string | null;
  members: Array<{ userId: string; role: "OWNER" | "ADMIN" | "MEMBER" }>;
  lastMessage: Message | null;
};

type Message = {
  id: string;
  text: string | null;
  attachment?: { id: string } | null;
  createdAt: string;
  sender: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    phone: string;
  };
};

type Contact = {
  id: string;
  createdAt: string;
  user: UserPreview;
};

type SearchResult = UserPreview & { isContact: boolean };

type FeedPost = {
  id: string;
  text: string | null;
  attachmentId: string | null;
  createdAt: string;
  likesCount: number;
  likedByMe: boolean;
  author: UserPreview;
};

type ProfileResponse = {
  user: User;
  counters: {
    contactsCount: number;
    chatsCount: number;
    postsCount: number;
  };
};

type IconName = "chats" | "contacts" | "feed" | "search" | "groups" | "send" | "clip" | "logout" | "heart" | "camera" | "save" | "phone";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost/api";

const UI_TEXT = {
  ru: {
    language: "Язык",
    loginTitle: "Вход в Anfeelgram",
    loginHint: "Введите номер телефона. OTP и облачный пароль будут запрошены на следующих шагах.",
    phoneLabel: "Телефон",
    continueBtn: "Продолжить",
    sendingBtn: "Отправка...",
    otpLabel: "OTP код",
    cloudLabel: "Облачный пароль",
    cloudPlaceholder: "Введите пароль",
    backBtn: "Назад",
    signInBtn: "Войти",
    checkingBtn: "Проверка...",
    codeSent: "Код отправлен. Введите OTP.",
    cloudRequired: "Для этого устройства нужен облачный пароль.",
    devOtp: "Dev OTP",
    logout: "Выйти",
    loading: "Загрузка...",
    chats: "Чаты",
    contacts: "Контакты",
    feed: "Лента",
    search: "Поиск",
    groups: "Группы",
    chatsTitle: "Диалоги",
    chatsEmpty: "Чатов пока нет",
    messagesEmpty: "Начните переписку первым сообщением",
    pickChat: "Выберите чат",
    pickChatHint: "Список диалогов находится слева.",
    typeMessage: "Сообщение",
    sendMessage: "Отправить",
    attachPhoto: "Прикрепить фото",
    selectedPhoto: "Выбрано фото",
    contactsTitle: "Ваши контакты",
    contactsEmpty: "Контактов пока нет. Добавьте людей через поиск.",
    openChat: "Чат",
    addContact: "Добавить",
    removeContact: "Удалить",
    searchTitle: "Поиск людей",
    searchHint: "Ищите по имени, фамилии или номеру.",
    searchPlaceholder: "Например: Иван или +79990000000",
    searchBtn: "Найти",
    noResults: "Ничего не найдено",
    groupsTitle: "Создать группу",
    groupName: "Название группы",
    groupNamePlaceholder: "Например: Product Team",
    groupMembers: "Участники (до 100)",
    createGroup: "Создать группу",
    groupNameRequired: "Введите название группы",
    groupMembersRequired: "Выберите хотя бы одного участника",
    newPost: "Новый пост",
    postPlaceholder: "Что нового?",
    publish: "Опубликовать",
    like: "Лайк",
    unlike: "Убрать лайк",
    likes: "Лайков",
    profileTitle: "Профиль",
    firstName: "Имя",
    lastName: "Фамилия",
    bio: "О себе",
    saveProfile: "Сохранить профиль",
    uploadPhoto: "Загрузить фото",
    quickActions: "Быстрые действия",
    openSearch: "Найти людей",
    openGroups: "Новая группа",
    openFeed: "Новый пост",
    onboardingTitle: "Заполните профиль",
    onboardingHint: "Добавьте имя, фамилию и фото, чтобы вас можно было находить.",
    optional: "необязательно",
    cloudPasswordStatusOn: "Облачный пароль включен",
    cloudPasswordStatusOff: "Облачный пароль не включен",
    languageInApp: "Язык интерфейса",
    statsChats: "Чаты",
    statsContacts: "Контакты",
    statsPosts: "Посты"
  },
  en: {
    language: "Language",
    loginTitle: "Anfeelgram Login",
    loginHint: "Enter your phone number. OTP and cloud password are requested in separate steps.",
    phoneLabel: "Phone",
    continueBtn: "Continue",
    sendingBtn: "Sending...",
    otpLabel: "OTP code",
    cloudLabel: "Cloud password",
    cloudPlaceholder: "Enter password",
    backBtn: "Back",
    signInBtn: "Sign in",
    checkingBtn: "Checking...",
    codeSent: "Code sent. Enter OTP.",
    cloudRequired: "Cloud password is required for this device.",
    devOtp: "Dev OTP",
    logout: "Logout",
    loading: "Loading...",
    chats: "Chats",
    contacts: "Contacts",
    feed: "Feed",
    search: "Search",
    groups: "Groups",
    chatsTitle: "Dialogs",
    chatsEmpty: "No chats yet",
    messagesEmpty: "Start with your first message",
    pickChat: "Select a chat",
    pickChatHint: "Your dialog list is on the left.",
    typeMessage: "Message",
    sendMessage: "Send",
    attachPhoto: "Attach photo",
    selectedPhoto: "Photo selected",
    contactsTitle: "Your contacts",
    contactsEmpty: "No contacts yet. Add users via search.",
    openChat: "Chat",
    addContact: "Add",
    removeContact: "Remove",
    searchTitle: "Find people",
    searchHint: "Search by first name, last name, or phone.",
    searchPlaceholder: "Example: John or +79990000000",
    searchBtn: "Search",
    noResults: "No results",
    groupsTitle: "Create group",
    groupName: "Group name",
    groupNamePlaceholder: "Example: Product Team",
    groupMembers: "Members (up to 100)",
    createGroup: "Create group",
    groupNameRequired: "Enter group name",
    groupMembersRequired: "Select at least one member",
    newPost: "New post",
    postPlaceholder: "What's new?",
    publish: "Publish",
    like: "Like",
    unlike: "Unlike",
    likes: "Likes",
    profileTitle: "Profile",
    firstName: "First name",
    lastName: "Last name",
    bio: "Bio",
    saveProfile: "Save profile",
    uploadPhoto: "Upload photo",
    quickActions: "Quick actions",
    openSearch: "Find people",
    openGroups: "New group",
    openFeed: "New post",
    onboardingTitle: "Complete profile",
    onboardingHint: "Add your first name, last name, and photo so people can find you.",
    optional: "optional",
    cloudPasswordStatusOn: "Cloud password enabled",
    cloudPasswordStatusOff: "Cloud password disabled",
    languageInApp: "Interface language",
    statsChats: "Chats",
    statsContacts: "Contacts",
    statsPosts: "Posts"
  }
} as const;

const ERROR_TEXT: Record<string, Record<UiLang, string>> = {
  INVALID_PAYLOAD: { ru: "Некорректные данные запроса.", en: "Invalid request payload." },
  OTP_NOT_FOUND: { ru: "OTP не найден.", en: "OTP not found." },
  OTP_EXPIRED: { ru: "OTP истек.", en: "OTP expired." },
  OTP_LOCKED: { ru: "Слишком много попыток. Попробуйте позже.", en: "Too many attempts. Try again later." },
  INVALID_OTP: { ru: "Неверный OTP.", en: "Invalid OTP." },
  CLOUD_PASSWORD_REQUIRED: { ru: "Требуется облачный пароль.", en: "Cloud password required." },
  USER_BANNED: { ru: "Пользователь заблокирован.", en: "User is banned." },
  UNAUTHORIZED: { ru: "Требуется авторизация.", en: "Unauthorized." },
  API_ERROR: { ru: "Ошибка API.", en: "API error." },
  INTERNAL_ERROR: { ru: "Внутренняя ошибка сервера.", en: "Internal server error." }
};

const NAV_ITEMS: Array<{ section: Section; icon: IconName; textKey: keyof (typeof UI_TEXT)["en"] }> = [
  { section: "chats", icon: "chats", textKey: "chats" },
  { section: "contacts", icon: "contacts", textKey: "contacts" },
  { section: "feed", icon: "feed", textKey: "feed" },
  { section: "search", icon: "search", textKey: "search" },
  { section: "groups", icon: "groups", textKey: "groups" }
];

function mapError(errorCode: string, uiLang: UiLang): string {
  return ERROR_TEXT[errorCode]?.[uiLang] ?? errorCode;
}

function fullName(user: Partial<UserPreview & User>): string {
  const fromNames = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return fromNames || user.displayName || user.phone || "Unknown";
}

function initials(user: Partial<UserPreview & User>): string {
  const first = (user.firstName ?? "").trim().slice(0, 1);
  const last = (user.lastName ?? "").trim().slice(0, 1);
  const combo = `${first}${last}`.trim();
  return combo ? combo.toUpperCase() : (user.displayName ?? user.phone ?? "A").slice(0, 1).toUpperCase();
}

function formatTime(value: string, uiLang: UiLang): string {
  const locale = uiLang === "ru" ? "ru-RU" : "en-US";
  return new Date(value).toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function apiRequest<T>(path: string, method: string, body?: unknown, accessToken?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });

  let json: Record<string, unknown> = {};
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    // ignore
  }

  if (!response.ok) {
    throw new Error((json.error as string | undefined) ?? "API_ERROR");
  }

  return json as T;
}

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

function Icon({ name, ...props }: IconProps) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  if (name === "chats") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9l-5 5v-13.5Z" {...common} />
      </svg>
    );
  }
  if (name === "contacts") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <circle cx="10" cy="8" r="3.5" {...common} />
        <path d="M15.5 19a5.5 5.5 0 0 0-11 0" {...common} />
      </svg>
    );
  }
  if (name === "feed") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <rect x="4" y="4" width="16" height="16" rx="3" {...common} />
        <path d="M8 8h8M8 12h8M8 16h5" {...common} />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <circle cx="11" cy="11" r="6" {...common} />
        <path d="m20 20-4.2-4.2" {...common} />
      </svg>
    );
  }
  if (name === "groups") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <circle cx="8" cy="9" r="3" {...common} />
        <circle cx="16" cy="8" r="2.5" {...common} />
        <path d="M4 19a4.5 4.5 0 0 1 8 0M13 19a3.5 3.5 0 0 1 7 0" {...common} />
      </svg>
    );
  }
  if (name === "send") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M3 11.5 21 4l-7.5 16-2.2-6.3L3 11.5Z" {...common} />
      </svg>
    );
  }
  if (name === "clip") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="m8.5 12.5 6.6-6.6a3.5 3.5 0 0 1 5 5l-8.8 8.8a5 5 0 1 1-7.1-7.1l8.8-8.8" {...common} />
      </svg>
    );
  }
  if (name === "logout") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" {...common} />
        <path d="M16 17l5-5-5-5M21 12H9" {...common} />
      </svg>
    );
  }
  if (name === "heart") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M12 20s-7-4.4-9-8.4C1.4 8 3.1 5 6.6 5A5.3 5.3 0 0 1 12 8.3 5.3 5.3 0 0 1 17.4 5C20.9 5 22.6 8 21 11.6 19 15.6 12 20 12 20Z" {...common} />
      </svg>
    );
  }
  if (name === "camera") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" {...common} />
        <circle cx="12" cy="14" r="3.5" {...common} />
      </svg>
    );
  }
  if (name === "save") {
    return (
      <svg viewBox="0 0 24 24" {...props}>
        <path d="M5 4h11l3 3v13H5V4Z" {...common} />
        <path d="M8 4v6h8V4" {...common} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M5 12h14" {...common} />
    </svg>
  );
}

export function App() {
  const [uiLang, setUiLang] = useState<UiLang>(() => {
    const saved = localStorage.getItem("afg_ui_lang");
    if (saved === "ru" || saved === "en") return saved;
    return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
  });

  const [authStep, setAuthStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("+7");
  const [otpCode, setOtpCode] = useState("");
  const [cloudPassword, setCloudPassword] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  const [accessToken, setAccessToken] = useState(localStorage.getItem("afg_access") ?? "");
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem("afg_refresh") ?? "");

  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<ProfileResponse["counters"] | null>(null);
  const [section, setSection] = useState<Section>("chats");
  const [bootstrapping, setBootstrapping] = useState(false);

  const [chats, setChats] = useState<Chat[]>([]);
  const [chatFilter, setChatFilter] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftImage, setDraftImage] = useState<File | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [newPostText, setNewPostText] = useState("");
  const [newPostImage, setNewPostImage] = useState<File | null>(null);

  const [groupTitle, setGroupTitle] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  const [onboardingFirstName, setOnboardingFirstName] = useState("");
  const [onboardingLastName, setOnboardingLastName] = useState("");
  const [onboardingBio, setOnboardingBio] = useState("");
  const [onboardingPhoto, setOnboardingPhoto] = useState<File | null>(null);

  const [quickFirstName, setQuickFirstName] = useState("");
  const [quickLastName, setQuickLastName] = useState("");
  const [quickBio, setQuickBio] = useState("");
  const [quickAvatar, setQuickAvatar] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const t = UI_TEXT[uiLang];
  const locale = uiLang === "ru" ? "ru-RU" : "en-US";

  const filteredChats = useMemo(() => {
    const query = chatFilter.trim().toLowerCase();
    if (!query) return chats;
    return chats.filter((chat) => {
      const title = (chat.title ?? "").toLowerCase();
      const lastMessage = (chat.lastMessage?.text ?? "").toLowerCase();
      return title.includes(query) || lastMessage.includes(query);
    });
  }, [chatFilter, chats]);

  const activeChat = useMemo(() => chats.find((item) => item.id === activeChatId) ?? null, [activeChatId, chats]);

  useEffect(() => {
    localStorage.setItem("afg_ui_lang", uiLang);
  }, [uiLang]);

  useEffect(() => {
    if (!accessToken || user) return;
    void bootstrapSession(accessToken);
  }, [accessToken, user]);

  useEffect(() => {
    if (!activeChatId || !accessToken || section !== "chats") return;
    void loadMessages(activeChatId, accessToken);
  }, [activeChatId, accessToken, section]);

  useEffect(() => {
    if (!activeChatId) return;
    const exists = chats.some((chat) => chat.id === activeChatId);
    if (!exists) setActiveChatId(chats[0]?.id ?? null);
  }, [activeChatId, chats]);

  async function uploadImage(file: File, token = accessToken): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const data = await apiRequest<{ attachment: { id: string } }>("/v1/attachments/image", "POST", formData, token);
    return data.attachment.id;
  }

  function attachmentPreviewUrl(attachmentId?: string | null): string {
    if (!attachmentId || !accessToken) return "";
    return `${API_URL}/v1/attachments/${attachmentId}?preview=1&token=${encodeURIComponent(accessToken)}`;
  }

  async function fetchProfile(token = accessToken): Promise<ProfileResponse> {
    return apiRequest<ProfileResponse>("/v1/profile/me", "GET", undefined, token);
  }

  async function loadChats(token = accessToken): Promise<void> {
    if (!token) return;
    const data = await apiRequest<{ chats: Chat[] }>("/v1/chats", "GET", undefined, token);
    setChats(data.chats);
    if (data.chats.length > 0 && !activeChatId) setActiveChatId(data.chats[0].id);
  }

  async function loadMessages(chatId: string, token = accessToken): Promise<void> {
    if (!token) return;
    const data = await apiRequest<{ messages: Message[] }>(`/v1/chats/${chatId}/messages`, "GET", undefined, token);
    setMessages(data.messages.reverse());
  }
  async function loadContacts(token = accessToken): Promise<void> {
    if (!token) return;
    const data = await apiRequest<{ contacts: Contact[] }>("/v1/contacts", "GET", undefined, token);
    setContacts(data.contacts);
  }

  async function loadFeed(token = accessToken): Promise<void> {
    if (!token) return;
    const data = await apiRequest<{ posts: FeedPost[] }>("/v1/feed/posts?limit=40", "GET", undefined, token);
    setFeedPosts(data.posts);
  }

  async function bootstrapSession(token = accessToken): Promise<void> {
    if (!token) return;

    try {
      setBootstrapping(true);
      const profile = await fetchProfile(token);
      setUser(profile.user);
      setStats(profile.counters);

      if (!onboardingFirstName) setOnboardingFirstName(profile.user.firstName ?? "");
      if (!onboardingLastName) setOnboardingLastName(profile.user.lastName ?? "");
      if (!onboardingBio) setOnboardingBio(profile.user.bio ?? "");
      setQuickFirstName(profile.user.firstName ?? "");
      setQuickLastName(profile.user.lastName ?? "");
      setQuickBio(profile.user.bio ?? "");

      await Promise.all([loadChats(token), loadContacts(token), loadFeed(token)]);
    } catch {
      await logout(true);
    } finally {
      setBootstrapping(false);
    }
  }

  async function requestOtp(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setInfo(null);

    try {
      setLoading(true);
      const data = await apiRequest<{ otpDebug?: string }>("/v1/auth/request-otp", "POST", { phone });
      setDebugOtp(data.otpDebug ?? null);
      setAuthStep("otp");
      setInfo(t.codeSent);
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(cloudPasswordArg?: string): Promise<void> {
    setError(null);
    setInfo(null);

    try {
      setLoading(true);
      const data = await apiRequest<{ accessToken: string; refreshToken: string; user: User }>("/v1/auth/verify-otp", "POST", {
        phone,
        code: otpCode,
        cloudPassword: cloudPasswordArg || undefined,
        locale: uiLang
      });

      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
      localStorage.setItem("afg_access", data.accessToken);
      localStorage.setItem("afg_refresh", data.refreshToken);
      await bootstrapSession(data.accessToken);
    } catch (e) {
      const errorCode = (e as Error).message;
      if (errorCode === "CLOUD_PASSWORD_REQUIRED") {
        setAuthStep("cloud_password");
        setInfo(t.cloudRequired);
        return;
      }
      setError(mapError(errorCode, uiLang));
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(event: FormEvent): Promise<void> {
    event.preventDefault();
    await verifyOtp();
  }

  async function submitCloudPassword(event: FormEvent): Promise<void> {
    event.preventDefault();
    await verifyOtp(cloudPassword);
  }

  async function saveOnboarding(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!accessToken || !user) return;

    if (!onboardingFirstName.trim() || !onboardingLastName.trim()) {
      setError(`${t.firstName} / ${t.lastName}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let avatarAttachmentId: string | null | undefined = undefined;
      if (onboardingPhoto) avatarAttachmentId = await uploadImage(onboardingPhoto, accessToken);

      const data = await apiRequest<{ user: User }>(
        "/v1/profile/me",
        "PATCH",
        {
          firstName: onboardingFirstName.trim(),
          lastName: onboardingLastName.trim(),
          bio: onboardingBio.trim() || undefined,
          avatarAttachmentId
        },
        accessToken
      );

      setUser(data.user);
      const profile = await fetchProfile(accessToken);
      setStats(profile.counters);
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    } finally {
      setLoading(false);
    }
  }

  async function saveQuickProfile(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    if (!accessToken || !user) return;

    try {
      setLoading(true);
      setError(null);

      let avatarAttachmentId = user.avatarAttachmentId;
      if (quickAvatar) avatarAttachmentId = await uploadImage(quickAvatar, accessToken);

      const data = await apiRequest<{ user: User }>(
        "/v1/profile/me",
        "PATCH",
        {
          firstName: quickFirstName.trim() || undefined,
          lastName: quickLastName.trim() || undefined,
          bio: quickBio.trim() || undefined,
          avatarAttachmentId
        },
        accessToken
      );

      setUser(data.user);
      setQuickAvatar(null);
      const profile = await fetchProfile(accessToken);
      setStats(profile.counters);
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    } finally {
      setLoading(false);
    }
  }

  async function startPrivateChat(targetUserId: string): Promise<void> {
    if (!accessToken) return;

    try {
      const data = await apiRequest<{ chatId: string }>("/v1/chats/private", "POST", { targetUserId }, accessToken);
      await loadChats(accessToken);
      setSection("chats");
      setActiveChatId(data.chatId);
      await loadMessages(data.chatId, accessToken);
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    }
  }

  async function sendMessage(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!accessToken || !activeChatId) return;

    const messageText = draftMessage.trim();
    if (!messageText && !draftImage) return;

    try {
      setLoading(true);
      let attachmentId: string | undefined;
      if (draftImage) attachmentId = await uploadImage(draftImage, accessToken);

      await apiRequest(`/v1/chats/${activeChatId}/messages`, "POST", { text: messageText || undefined, attachmentId }, accessToken);

      setDraftMessage("");
      setDraftImage(null);
      await loadMessages(activeChatId, accessToken);
      await loadChats(accessToken);
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    } finally {
      setLoading(false);
    }
  }

  async function runUserSearch(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    if (!accessToken) return;

    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    try {
      const data = await apiRequest<{ users: SearchResult[] }>(`/v1/users/search?q=${encodeURIComponent(query)}`, "GET", undefined, accessToken);
      setSearchResults(data.users);
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    }
  }

  async function addContact(targetUserId: string): Promise<void> {
    if (!accessToken) return;
    try {
      await apiRequest("/v1/contacts", "POST", { targetUserId }, accessToken);
      await Promise.all([loadContacts(accessToken), runUserSearch()]);
      const profile = await fetchProfile(accessToken);
      setStats(profile.counters);
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    }
  }

  async function removeContact(targetUserId: string): Promise<void> {
    if (!accessToken) return;
    try {
      await apiRequest(`/v1/contacts/${targetUserId}`, "DELETE", undefined, accessToken);
      await Promise.all([loadContacts(accessToken), runUserSearch()]);
      const profile = await fetchProfile(accessToken);
      setStats(profile.counters);
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    }
  }

  async function createGroup(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!accessToken) return;

    if (!groupTitle.trim()) {
      setError(t.groupNameRequired);
      return;
    }
    if (groupMembers.length < 1) {
      setError(t.groupMembersRequired);
      return;
    }

    try {
      setLoading(true);
      const data = await apiRequest<{ chatId: string }>(
        "/v1/chats/group",
        "POST",
        {
          title: groupTitle.trim(),
          memberIds: groupMembers
        },
        accessToken
      );

      setGroupTitle("");
      setGroupMembers([]);
      await loadChats(accessToken);
      setSection("chats");
      setActiveChatId(data.chatId);
      await loadMessages(data.chatId, accessToken);
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    } finally {
      setLoading(false);
    }
  }
  async function createPost(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!accessToken) return;

    const text = newPostText.trim();
    if (!text && !newPostImage) return;

    try {
      setLoading(true);
      let attachmentId: string | undefined;
      if (newPostImage) attachmentId = await uploadImage(newPostImage, accessToken);

      await apiRequest("/v1/feed/posts", "POST", { text: text || undefined, attachmentId }, accessToken);
      setNewPostText("");
      setNewPostImage(null);
      await loadFeed(accessToken);
      const profile = await fetchProfile(accessToken);
      setStats(profile.counters);
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    } finally {
      setLoading(false);
    }
  }

  async function toggleLike(postId: string): Promise<void> {
    if (!accessToken) return;

    try {
      const data = await apiRequest<{ likedByMe: boolean; likesCount: number }>(`/v1/feed/posts/${postId}/like`, "POST", undefined, accessToken);
      setFeedPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, likedByMe: data.likedByMe, likesCount: data.likesCount } : post)));
    } catch (e) {
      setError(mapError((e as Error).message, uiLang));
    }
  }

  async function logout(skipApi = false): Promise<void> {
    if (!skipApi && accessToken) {
      try {
        await apiRequest("/v1/auth/logout", "POST", undefined, accessToken);
      } catch {
        // ignore logout API errors
      }
    }

    setAccessToken("");
    setRefreshToken("");
    setUser(null);
    setStats(null);
    setChats([]);
    setMessages([]);
    setContacts([]);
    setSearchResults([]);
    setFeedPosts([]);
    setActiveChatId(null);
    setSection("chats");

    localStorage.removeItem("afg_access");
    localStorage.removeItem("afg_refresh");
  }

  const onboardingVisible = Boolean(accessToken && user?.needsOnboarding);
  const avatarUrl = user?.avatarAttachmentId ? `${API_URL}/v1/attachments/${user.avatarAttachmentId}?preview=1&token=${encodeURIComponent(accessToken)}` : "";

  if (!accessToken || !user) {
    return (
      <div className="auth-shell">
        <div className="auth-glow auth-glow-a" />
        <div className="auth-glow auth-glow-b" />

        <div className="auth-card">
          <div className="auth-topbar">
            <div className="brand-mark">AFG</div>
            <div className="lang-switch" role="group" aria-label={t.language}>
              <button type="button" className={`chip ${uiLang === "ru" ? "active" : ""}`} onClick={() => setUiLang("ru")}>RU</button>
              <button type="button" className={`chip ${uiLang === "en" ? "active" : ""}`} onClick={() => setUiLang("en")}>EN</button>
            </div>
          </div>

          <h1>{t.loginTitle}</h1>
          <p>{t.loginHint}</p>

          {authStep === "phone" && (
            <form className="form-grid" onSubmit={requestOtp}>
              <label>
                <span>{t.phoneLabel}</span>
                <div className="input-icon-wrap">
                  <Icon name="phone" width={18} height={18} />
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+79990000000" />
                </div>
              </label>
              <button className="btn btn-primary" disabled={loading || phone.trim().length < 6} type="submit">
                {loading ? t.sendingBtn : t.continueBtn}
              </button>
            </form>
          )}

          {authStep === "otp" && (
            <form className="form-grid" onSubmit={submitOtp}>
              <label>
                <span>{t.otpLabel}</span>
                <input value={otpCode} onChange={(event) => setOtpCode(event.target.value)} maxLength={12} />
              </label>
              <div className="inline-actions">
                <button className="btn btn-ghost" type="button" onClick={() => { setAuthStep("phone"); setInfo(null); setError(null); }}>
                  {t.backBtn}
                </button>
                <button className="btn btn-primary" disabled={loading || otpCode.trim().length < 1} type="submit">
                  {loading ? t.checkingBtn : t.signInBtn}
                </button>
              </div>
            </form>
          )}

          {authStep === "cloud_password" && (
            <form className="form-grid" onSubmit={submitCloudPassword}>
              <label>
                <span>{t.cloudLabel}</span>
                <input type="password" value={cloudPassword} onChange={(event) => setCloudPassword(event.target.value)} placeholder={t.cloudPlaceholder} />
              </label>
              <button className="btn btn-primary" disabled={loading || cloudPassword.trim().length < 1} type="submit">
                {loading ? t.checkingBtn : t.signInBtn}
              </button>
            </form>
          )}

          {debugOtp && authStep !== "phone" && <div className="badge badge-info">{t.devOtp}: {debugOtp}</div>}
          {info && <div className="badge badge-info">{info}</div>}
          {error && <div className="badge badge-error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">AFG</div>
          <div>
            <div className="brand-title">Anfeelgram</div>
            <div className="brand-subtitle">{fullName(user)}</div>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.section}
              type="button"
              className={`nav-item ${section === item.section ? "active" : ""}`}
              onClick={() => setSection(item.section)}
              title={t[item.textKey]}
            >
              <Icon name={item.icon} width={19} height={19} />
              <span>{t[item.textKey]}</span>
            </button>
          ))}
        </nav>

        <div className="stats-block">
          <div><span>{t.statsChats}</span><strong>{stats?.chatsCount ?? 0}</strong></div>
          <div><span>{t.statsContacts}</span><strong>{stats?.contactsCount ?? 0}</strong></div>
          <div><span>{t.statsPosts}</span><strong>{stats?.postsCount ?? 0}</strong></div>
        </div>

        <button className="btn btn-ghost logout-btn" type="button" onClick={() => void logout(false)}>
          <Icon name="logout" width={16} height={16} />
          <span>{t.logout}</span>
        </button>
      </aside>

      <main className="main-panel">
        <header className="main-header">
          <div>
            <h2>{section === "chats" ? t.chats : section === "contacts" ? t.contacts : section === "feed" ? t.feed : section === "search" ? t.search : t.groups}</h2>
            <p>{user.phone}</p>
          </div>
          <div className="lang-switch" role="group" aria-label={t.languageInApp}>
            <button type="button" className={`chip ${uiLang === "ru" ? "active" : ""}`} onClick={() => setUiLang("ru")}>RU</button>
            <button type="button" className={`chip ${uiLang === "en" ? "active" : ""}`} onClick={() => setUiLang("en")}>EN</button>
          </div>
        </header>

        {error && <div className="badge badge-error">{error}</div>}
        {info && <div className="badge badge-info">{info}</div>}
        {bootstrapping && <div className="badge badge-info">{t.loading}</div>}
        {section === "chats" && (
          <div className="chat-layout">
            <section className="panel chat-list-panel">
              <div className="panel-head">
                <h3>{t.chatsTitle}</h3>
              </div>
              <input value={chatFilter} onChange={(event) => setChatFilter(event.target.value)} placeholder={t.searchPlaceholder} />
              <div className="chat-list-scroll">
                {filteredChats.length === 0 && <div className="empty-state">{t.chatsEmpty}</div>}
                {filteredChats.map((chat) => (
                  <button key={chat.id} type="button" className={`chat-item ${chat.id === activeChatId ? "active" : ""}`} onClick={() => setActiveChatId(chat.id)}>
                    <div className="avatar-chip">{chat.title ? chat.title.slice(0, 1).toUpperCase() : "#"}</div>
                    <div className="chat-meta">
                      <strong>{chat.title ?? t.chats}</strong>
                      <span>{chat.lastMessage?.text ?? "..."}</span>
                    </div>
                    <time>{chat.lastMessage ? formatTime(chat.lastMessage.createdAt, uiLang) : ""}</time>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel conversation-panel">
              {!activeChat && (
                <div className="conversation-empty">
                  <Icon name="chats" width={48} height={48} />
                  <h3>{t.pickChat}</h3>
                  <p>{t.pickChatHint}</p>
                </div>
              )}

              {activeChat && (
                <>
                  <div className="conversation-head">
                    <div className="head-main">
                      <div className="avatar-chip">{(activeChat.title ?? "C").slice(0, 1).toUpperCase()}</div>
                      <div>
                        <strong>{activeChat.title ?? t.chats}</strong>
                        <p>{activeChat.type === "GROUP" ? t.groups : t.chats}</p>
                      </div>
                    </div>
                  </div>

                  <div className="messages-scroll">
                    {messages.length === 0 && <div className="empty-state">{t.messagesEmpty}</div>}
                    {messages.map((msg) => (
                      <article key={msg.id} className={`message ${msg.sender.id === user.id ? "mine" : ""}`}>
                        <div className="message-head">
                          <span>{fullName(msg.sender)}</span>
                          <time>{formatTime(msg.createdAt, uiLang)}</time>
                        </div>
                        {msg.text && <div className="message-text">{msg.text}</div>}
                        {msg.attachment?.id && <img className="message-image" src={attachmentPreviewUrl(msg.attachment.id)} alt="attachment" />}
                      </article>
                    ))}
                  </div>

                  <form className="composer" onSubmit={sendMessage}>
                    <label className="icon-btn" title={t.attachPhoto}>
                      <Icon name="clip" width={18} height={18} />
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => setDraftImage(event.target.files?.[0] ?? null)}
                        disabled={!activeChatId}
                      />
                    </label>
                    <input
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      placeholder={t.typeMessage}
                      disabled={!activeChatId}
                    />
                    <button className="btn btn-primary" type="submit" disabled={!activeChatId || loading || (!draftMessage.trim() && !draftImage)}>
                      <Icon name="send" width={15} height={15} />
                      <span>{t.sendMessage}</span>
                    </button>
                  </form>
                  {draftImage && <div className="file-chip">{t.selectedPhoto}: {draftImage.name}</div>}
                </>
              )}
            </section>
          </div>
        )}

        {section === "contacts" && (
          <section className="panel section-panel">
            <div className="panel-head">
              <h3>{t.contactsTitle}</h3>
            </div>
            {contacts.length === 0 && <div className="empty-state">{t.contactsEmpty}</div>}
            <div className="entity-list">
              {contacts.map((contact) => (
                <article key={contact.id} className="entity-row">
                  <div className="entity-main">
                    <div className="avatar-chip">{initials(contact.user)}</div>
                    <div>
                      <strong>{fullName(contact.user)}</strong>
                      <p>{contact.user.phone}</p>
                    </div>
                  </div>
                  <div className="entity-actions">
                    <button className="btn btn-ghost" type="button" onClick={() => void startPrivateChat(contact.user.id)}>{t.openChat}</button>
                    <button className="btn btn-danger" type="button" onClick={() => void removeContact(contact.user.id)}>{t.removeContact}</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {section === "search" && (
          <section className="panel section-panel">
            <div className="panel-head">
              <h3>{t.searchTitle}</h3>
              <p>{t.searchHint}</p>
            </div>
            <form className="search-form" onSubmit={(event) => void runUserSearch(event)}>
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t.searchPlaceholder} />
              <button className="btn btn-primary" type="submit">
                <Icon name="search" width={15} height={15} />
                <span>{t.searchBtn}</span>
              </button>
            </form>
            {searchQuery.trim().length > 0 && searchResults.length === 0 && <div className="empty-state">{t.noResults}</div>}
            <div className="entity-list">
              {searchResults.map((person) => (
                <article key={person.id} className="entity-row">
                  <div className="entity-main">
                    <div className="avatar-chip">{initials(person)}</div>
                    <div>
                      <strong>{fullName(person)}</strong>
                      <p>{person.phone}</p>
                    </div>
                  </div>
                  <div className="entity-actions">
                    {!person.isContact && <button className="btn btn-ghost" type="button" onClick={() => void addContact(person.id)}>{t.addContact}</button>}
                    <button className="btn btn-primary" type="button" onClick={() => void startPrivateChat(person.id)}>{t.openChat}</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        {section === "groups" && (
          <section className="panel section-panel">
            <div className="panel-head">
              <h3>{t.groupsTitle}</h3>
            </div>
            <form className="form-grid" onSubmit={createGroup}>
              <label>
                <span>{t.groupName}</span>
                <input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder={t.groupNamePlaceholder} />
              </label>

              <div>
                <span className="block-label">{t.groupMembers}</span>
                <div className="chips-grid">
                  {contacts.map((contact) => {
                    const checked = groupMembers.includes(contact.user.id);
                    const disabled = !checked && groupMembers.length >= 100;
                    return (
                      <label key={contact.id} className={`member-chip ${checked ? "active" : ""} ${disabled ? "disabled" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setGroupMembers((prev) => [...prev, contact.user.id]);
                            } else {
                              setGroupMembers((prev) => prev.filter((id) => id !== contact.user.id));
                            }
                          }}
                        />
                        <span>{fullName(contact.user)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button className="btn btn-primary" type="submit" disabled={loading}>{t.createGroup}</button>
            </form>
          </section>
        )}

        {section === "feed" && (
          <div className="feed-layout">
            <section className="panel composer-panel">
              <div className="panel-head">
                <h3>{t.newPost}</h3>
              </div>
              <form className="form-grid" onSubmit={createPost}>
                <textarea rows={4} value={newPostText} onChange={(event) => setNewPostText(event.target.value)} placeholder={t.postPlaceholder} />
                <div className="inline-actions">
                  <label className="btn btn-ghost file-btn">
                    <Icon name="camera" width={15} height={15} />
                    <span>{t.attachPhoto}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setNewPostImage(event.target.files?.[0] ?? null)} />
                  </label>
                  <button className="btn btn-primary" type="submit" disabled={loading || (!newPostText.trim() && !newPostImage)}>
                    <Icon name="send" width={15} height={15} />
                    <span>{t.publish}</span>
                  </button>
                </div>
                {newPostImage && <div className="file-chip">{t.selectedPhoto}: {newPostImage.name}</div>}
              </form>
            </section>

            <section className="feed-stream">
              {feedPosts.map((post) => (
                <article key={post.id} className="panel post-card">
                  <div className="post-head">
                    <div className="entity-main">
                      <div className="avatar-chip">{initials(post.author)}</div>
                      <div>
                        <strong>{fullName(post.author)}</strong>
                        <p>{formatTime(post.createdAt, uiLang)}</p>
                      </div>
                    </div>
                  </div>
                  {post.text && <p className="post-text">{post.text}</p>}
                  {post.attachmentId && <img className="post-image" src={attachmentPreviewUrl(post.attachmentId)} alt="post" />}
                  <div className="post-actions">
                    <button className={`btn ${post.likedByMe ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => void toggleLike(post.id)}>
                      <Icon name="heart" width={15} height={15} />
                      <span>{post.likedByMe ? t.unlike : t.like}</span>
                    </button>
                    <span>{t.likes}: {post.likesCount}</span>
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}
      </main>

      <aside className="right-panel">
        <section className="panel profile-panel">
          <div className="panel-head">
            <h3>{t.profileTitle}</h3>
          </div>
          <div className="profile-top">
            <div className="profile-avatar" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : {}}>
              {!avatarUrl && <span>{initials(user)}</span>}
            </div>
            <div>
              <strong>{fullName(user)}</strong>
              <p>{user.phone}</p>
              <small>{user.hasCloudPassword ? t.cloudPasswordStatusOn : t.cloudPasswordStatusOff}</small>
            </div>
          </div>

          <form className="form-grid" onSubmit={saveQuickProfile}>
            <label>
              <span>{t.firstName}</span>
              <input value={quickFirstName} onChange={(event) => setQuickFirstName(event.target.value)} />
            </label>
            <label>
              <span>{t.lastName}</span>
              <input value={quickLastName} onChange={(event) => setQuickLastName(event.target.value)} />
            </label>
            <label>
              <span>{t.bio}</span>
              <textarea rows={2} value={quickBio} onChange={(event) => setQuickBio(event.target.value)} />
            </label>
            <div className="inline-actions">
              <label className="btn btn-ghost file-btn">
                <Icon name="camera" width={15} height={15} />
                <span>{t.uploadPhoto}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setQuickAvatar(event.target.files?.[0] ?? null)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                <Icon name="save" width={15} height={15} />
                <span>{t.saveProfile}</span>
              </button>
            </div>
            {quickAvatar && <div className="file-chip">{t.selectedPhoto}: {quickAvatar.name}</div>}
          </form>
        </section>

        <section className="panel quick-panel">
          <div className="panel-head">
            <h3>{t.quickActions}</h3>
          </div>
          <div className="quick-grid">
            <button className="btn btn-ghost" type="button" onClick={() => setSection("search")}>{t.openSearch}</button>
            <button className="btn btn-ghost" type="button" onClick={() => setSection("groups")}>{t.openGroups}</button>
            <button className="btn btn-ghost" type="button" onClick={() => setSection("feed")}>{t.openFeed}</button>
          </div>
        </section>
      </aside>

      {onboardingVisible && (
        <div className="modal-overlay">
          <form className="modal-card" onSubmit={saveOnboarding}>
            <h2>{t.onboardingTitle}</h2>
            <p>{t.onboardingHint}</p>

            <label>
              <span>{t.firstName}</span>
              <input value={onboardingFirstName} onChange={(event) => setOnboardingFirstName(event.target.value)} placeholder="Ivan" />
            </label>

            <label>
              <span>{t.lastName}</span>
              <input value={onboardingLastName} onChange={(event) => setOnboardingLastName(event.target.value)} placeholder="Ivanov" />
            </label>

            <label>
              <span>{t.bio} ({t.optional})</span>
              <textarea rows={3} value={onboardingBio} onChange={(event) => setOnboardingBio(event.target.value)} />
            </label>

            <label className="btn btn-ghost file-btn">
              <Icon name="camera" width={15} height={15} />
              <span>{t.uploadPhoto} ({t.optional})</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setOnboardingPhoto(event.target.files?.[0] ?? null)} />
            </label>
            {onboardingPhoto && <div className="file-chip">{t.selectedPhoto}: {onboardingPhoto.name}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading}>{t.saveProfile}</button>
          </form>
        </div>
      )}
    </div>
  );
}
