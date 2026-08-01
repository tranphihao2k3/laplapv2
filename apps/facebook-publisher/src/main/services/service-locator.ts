/**
 * Service locator — singleton lazy init cho settings + auth service.
 *
 * Tách khỏi từng service để tránh circular dep khi thêm service khác
 * (queue, products, ...) sau này.
 *
 * Caller gọi `getCached*Service()` bất kỳ lúc nào — nếu chưa init, throw
 * UNAVAILABLE.
 *
 * `initServices(db, settings)` được gọi trong `app.whenReady()` sau khi
 * openDb + runMigrations xong. AuthService được khởi tạo ở đây vì nó
 * cần `app.getPath('userData')` (Electron runtime).
 *
 * SupabaseAuthClient dùng callback cho `getApiBaseUrl()` — UI thay đổi
 * setting.apiBaseUrl sẽ được thấy ngay lập tức, không phải khởi tạo lại.
 */
import { app } from "electron";
import { AppError } from "../../shared/errors";
import { SettingsRepository } from "../db/repositories/settings";
import { SettingsService } from "../services/settings-service";
import { AuthService } from "../services/auth-service";
import { SupabaseAuthClient } from "../api/supabase-auth-client";
import { ProductRepository } from "../db/repositories/products";
import { CatalogService } from "../services/catalog-service";
import { ImageService } from "../services/image-service";
import { GroupService, GroupSetService } from "../services/group-service";
import { FacebookGroupRepository, GroupSetRepository } from "../db/repositories/facebook-groups";
import { TemplateService } from "../services/template-service";
import { TemplateRepository } from "../db/repositories/templates";
import { CampaignService } from "../services/campaign-service";
import { CampaignRepository } from "../db/repositories/campaigns";
import { env } from "../env";

let settingsService: SettingsService | null = null;
let authService: AuthService | null = null;
let supabaseAuthClient: SupabaseAuthClient | null = null;
let catalogService: CatalogService | null = null;
let productRepository: ProductRepository | null = null;
let imageService: ImageService | null = null;
let settingsRepository: SettingsRepository | null = null;
let groupService: GroupService | null = null;
let groupSetService: GroupSetService | null = null;
let groupRepository: FacebookGroupRepository | null = null;
let groupSetRepository: GroupSetRepository | null = null;
let templateService: TemplateService | null = null;
let templateRepository: TemplateRepository | null = null;
let campaignService: CampaignService | null = null;
let campaignRepository: CampaignRepository | null = null;
let postJobRepository: PostJobRepository | null = null;

export function initServices(db: import("better-sqlite3").Database): void {
  const settingsRepo = new SettingsRepository(db);
  settingsService = new SettingsService(settingsRepo);
  authService = new AuthService(app.getPath("userData"));
  supabaseAuthClient = new SupabaseAuthClient(() => {
    try {
      return settingsService?.get().apiBaseUrl ?? env.defaultApiBaseUrl;
    } catch {
      return env.defaultApiBaseUrl;
    }
  });

  const productRepo = new ProductRepository(db);
  productRepository = productRepo;
  catalogService = new CatalogService(
    productRepo,
    settingsRepo,
    () => settingsService?.get().apiBaseUrl ?? env.defaultApiBaseUrl,
    () => authService?.getAccessToken() ?? null,
  );
  settingsRepository = settingsRepo;
  imageService = new ImageService(settingsRepo, app.getPath("userData"));
  groupRepository = new FacebookGroupRepository(db);
  groupSetRepository = new GroupSetRepository(db);
  groupService = new GroupService(groupRepository, groupSetRepository);
  groupSetService = new GroupSetService(groupSetRepository);
  templateRepository = new TemplateRepository(db);
  templateService = new TemplateService(templateRepository);
  campaignRepository = new CampaignRepository(db);
  postJobRepository = new PostJobRepository(db);
  campaignService = new CampaignService(
    campaignRepository,
    postJobRepository,
    productRepository,
    templateRepository,
    groupRepository,
    groupSetRepository,
  );
}

export function getCachedSettingsService(): SettingsService {
  if (!settingsService) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "Services chưa được khởi tạo — gọi initServices() trong app.whenReady() trước khi IPC tới",
      503,
    );
  }
  return settingsService;
}

export function getCachedAuthService(): AuthService {
  if (!authService) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "AuthService chưa sẵn sàng — gọi initServices() trước",
      503,
    );
  }
  return authService;
}

export function getCachedSupabaseAuthClient(): SupabaseAuthClient {
  if (!supabaseAuthClient) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "SupabaseAuthClient chưa sẵn sàng — gọi initServices() trước",
      503,
    );
  }
  return supabaseAuthClient;
}

export function getCachedCatalogService(): CatalogService {
  if (!catalogService) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "CatalogService chưa sẵn sàng — gọi initServices() trước",
      503,
    );
  }
  return catalogService;
}

export function getCachedProductRepository(): ProductRepository {
  if (!productRepository) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "ProductRepository chưa sẵn sàng — gọi initServices() trước",
      503,
    );
  }
  return productRepository;
}

export function getCachedImageService(): ImageService {
  if (!imageService) {
    throw new AppError(
      "SERVICE_NOT_READY",
      "ImageService chưa sẵn sàng — gọi initServices() trước",
      503,
    );
  }
  return imageService;
}

export function getCachedGroupService(): GroupService {
  if (!groupService) {
    throw new AppError("SERVICE_NOT_READY", "GroupService chưa sẵn sàng", 503);
  }
  return groupService;
}

export function getCachedGroupSetService(): GroupSetService {
  if (!groupSetService) {
    throw new AppError("SERVICE_NOT_READY", "GroupSetService chưa sẵn sàng", 503);
  }
  return groupSetService;
}

export function getCachedGroupRepository(): FacebookGroupRepository {
  if (!groupRepository) {
    throw new AppError("SERVICE_NOT_READY", "FacebookGroupRepository chưa sẵn sàng", 503);
  }
  return groupRepository;
}

export function getCachedGroupSetRepository(): GroupSetRepository {
  if (!groupSetRepository) {
    throw new AppError("SERVICE_NOT_READY", "GroupSetRepository chưa sẵn sàng", 503);
  }
  return groupSetRepository;
}

export function getCachedTemplateService(): TemplateService {
  if (!templateService) {
    throw new AppError("SERVICE_NOT_READY", "TemplateService chưa sẵn sàng", 503);
  }
  return templateService;
}

export function getCachedTemplateRepository(): TemplateRepository {
  if (!templateRepository) {
    throw new AppError("SERVICE_NOT_READY", "TemplateRepository chưa sẵn sàng", 503);
  }
  return templateRepository;
}

export function getCachedCampaignService(): CampaignService {
  if (!campaignService) {
    throw new AppError("SERVICE_NOT_READY", "CampaignService chưa sẵn sàng", 503);
  }
  return campaignService;
}

export function getCachedCampaignRepository(): CampaignRepository {
  if (!campaignRepository) {
    throw new AppError("SERVICE_NOT_READY", "CampaignRepository chưa sẵn sàng", 503);
  }
  return campaignRepository;
}

export function getCachedPostJobRepository(): PostJobRepository {
  if (!postJobRepository) {
    throw new AppError("SERVICE_NOT_READY", "PostJobRepository chưa sẵn sàng", 503);
  }
  return postJobRepository;
}
