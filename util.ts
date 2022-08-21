import {
  datetime,
  DateTimeFormatter,
  fs,
  path,
  S3Bucket,
  YAML,
} from "./deps.ts";
import { ROOT_DOMAIN, TARGET_SITE_LANGUAEGS } from "./constant.ts";
import {
  Config,
  Language,
  PageMeta,
  SiteConfig,
  WeekOfYear,
} from "./interface.ts";
export const SECOND = 1e3;
export const MINUTE = SECOND * 60;
export const HOUR = MINUTE * 60;
export const DAY = HOUR * 24;
export const WEEK = DAY * 7;
const DAYS_PER_WEEK = 7;
enum Day {
  Sun,
  Mon,
  Tue,
  Wed,
  Thu,
  Fri,
  Sat,
}
export const get = (obj: unknown, path: string, defaultValue = undefined) => {
  const travel = (regexp: RegExp) =>
    String.prototype.split
      .call(path, regexp)
      .filter(Boolean)
      .reduce(
        (res, key) =>
          res !== null && res !== undefined
            ? (res as Record<string, string>)[key]
            : res,
        obj,
      );
  const result = travel(/[,[\]]+?/) || travel(/[,[\].]+?/);
  return result === undefined || result === obj ? defaultValue : result;
};
export const isDev = () => {
  return Deno.env.get("DEV") === "1";
};
export const isMock = () => {
  return !(Deno.env.get("MOCK") === "0");
};
export const isMockImage = () => {
  return !(Deno.env.get("MOCK_IMAGE") === "0");
};
export const isDebug = () => {
  return Deno.env.get("DEBUG") === "1";
};
export const getDataPath = () => {
  const dataPath = isDev() ? "dev-current" : "current";
  return dataPath;
};
export const getFeedSiteIdentifiers = (config: Config) => {
  const sitesMap = config.sites;
  const keys = Object.keys(sitesMap);
  const siteIdentifiers = keys.filter((key) => {
    const site = sitesMap[key];
    return !(site.test);
  });
  return siteIdentifiers;
};
export const getArchivePath = () => {
  const dataPath = isDev() ? "dev-archive" : "archive";
  return dataPath;
};
export const getDistPath = () => {
  return "public";
};
export const getSiteIdentifierDistPath = (siteIdentifier: string) => {
  return `${getDistPath()}/${siteIdentifierToPath(siteIdentifier)}`;
};
export const getDistFilePath = (siteIdentifier: string, file: string) => {
  return path.join(getDistPath(), siteIdentifierToPath(siteIdentifier), file);
};
export const getDataRawPath = () => {
  return `${getDataPath()}/1-raw`;
};
export const tryGetSiteByFolderPath = (folderPath: string): string | null => {
  const basename = path.basename(folderPath);
  if (basename.startsWith("site_")) {
    return basename.substring(5);
  } else {
    return null;
  }
};
export const getDataFormatedPath = () => {
  return `${getDataPath()}/2-formated`;
};

export const getDataTranslatedPath = () => {
  return `${getDataPath()}/3-translated`;
};

export const getDataCurrentItemsPath = () => {
  return `${getDataPath()}/4-data`;
};
export const getMigratedIssueMapPath = () => {
  return `./migrations/issue-map.json`;
};
export const getCurrentItemsFilePath = (siteIdentifier: string) => {
  return `${getDataCurrentItemsPath()}/${
    siteIdentifierToPath(siteIdentifier)
  }/items.json`;
};
export const getCurrentTagsFilePath = (siteIdentifier: string) => {
  return `${getDataCurrentItemsPath()}/${
    siteIdentifierToPath(siteIdentifier)
  }/tags.json`;
};

export const getCurrentIssuesFilePath = (siteIdentifier: string) => {
  return `${getDataCurrentItemsPath()}/${
    siteIdentifierToPath(siteIdentifier)
  }/issues.json`;
};
export const getCurrentKeysFilePath = (siteIdentifier: string) => {
  return `${getDataCurrentItemsPath()}/${
    siteIdentifierToPath(siteIdentifier)
  }/keys.json`;
};
export const getCurrentArchiveFilePath = (siteIdentifier: string) => {
  return `${getDataCurrentItemsPath()}/${
    siteIdentifierToPath(siteIdentifier)
  }/archive.json`;
};
export const getCurrentToBeArchivedItemsFilePath = (siteIdentifier: string) => {
  return `${getDataCurrentItemsPath()}/${
    siteIdentifierToPath(siteIdentifier)
  }/to-be-archived-items.json`;
};

export const readJSONFile = async (path: string) => {
  const file = await Deno.readTextFile(path);
  return JSON.parse(file);
};

export const writeTextFile = async (filePath: string, text: string) => {
  // ensure dir exists
  const dir = path.dirname(filePath);
  await fs.ensureDir(dir);
  await Deno.writeTextFile(filePath, text);
};

export const writeJSONFile = async (filePath: string, data: unknown) => {
  const file = JSON.stringify(data, null, 2);
  // ensure dir exists
  const dir = path.dirname(filePath);
  await fs.ensureDir(dir);
  await Deno.writeTextFile(filePath, file + "\n");
};
export const getFullYear = (date: Date): string => {
  return date.getUTCFullYear().toString();
};
export const getFullMonth = (date: Date): string => {
  const month = date.getUTCMonth() + 1;
  return month < 10 ? `0${month}` : month.toString();
};

export const getFullDay = (date: Date): string => {
  const day = date.getUTCDate();
  return day < 10 ? `0${day}` : day.toString();
};

export const getConfig = async function (): Promise<Config> {
  const config = YAML.parse(
    await Deno.readTextFile("config.yml"),
  ) as Config;
  return config;
};
export const getGenConfig = async function (): Promise<Config> {
  const config = await readJSONFile("./config.gen.json") as Config;
  return config;
};
const formatBeijing = (date: Date, formatString: string) => {
  date = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const formatter = new DateTimeFormatter(formatString);
  return formatter.format(date, {
    timeZone: "UTC",
  });
};
export const formatHumanTime = (date: Date) => {
  const now = new Date();
  const nowDate = formatBeijing(now, "yyyy-MM-dd");
  const dateDate = formatBeijing(date, "yyyy-MM-dd");
  const isToday = nowDate === dateDate;

  const nowYear = formatBeijing(now, "yyyy");
  const dateYear = formatBeijing(date, "yyyy");
  const isThisYear = nowYear === dateYear;

  if (isToday) {
    return formatBeijing(date, "HH:mm");
  } else if (isThisYear) {
    return formatBeijing(date, "MM-dd");
  } else {
    return formatBeijing(date, "yy-MM-dd");
  }
};

export const getArchivedFilePath = function (
  siteIdentifier: string,
  relativePath: string,
): string {
  let filePath = getArchivePath() + "/" +
    siteIdentifierToPath(siteIdentifier);
  // remove relative path slashes
  if (relativePath.startsWith("/")) {
    relativePath = relativePath.substring(1);
  }
  filePath += "/" + relativePath;
  return filePath;
};

export const siteIdentifierToPath = (siteIdentifier: string) => {
  // return siteIdentifier.replace(/\./g, "_");
  //
  return siteIdentifier;
};
export const siteIdentifierToDomain = (
  siteIdentifier: string,
  site?: SiteConfig,
) => {
  if (site && site.domain) {
    return site.domain;
  }
  if (siteIdentifier.includes(".")) {
    return siteIdentifier;
  }
  return `${siteIdentifier}.${ROOT_DOMAIN}`;
};
export const urlToSiteIdentifier = (url: string, config: Config) => {
  const urlObj = new URL(url);

  if (urlObj.hostname === "localhost") {
    if (Number(config.archive?.port) === Number(urlObj.port)) {
      return config.archive.siteIdentifier!;
    } else {
      for (const siteDdentifier in config.sites) {
        const siteConfig = config.sites[siteDdentifier];
        if (Number(siteConfig.port) === Number(urlObj.port)) {
          return siteDdentifier;
        }
      }
      throw new Error("Cannot find siteIdentifier for " + url);
    }
  } else {
    let hostname = urlObj.hostname;
    if (urlObj.hostname.startsWith("dev-")) {
      hostname = hostname.substring(4);
    }
    return hostname.replace(`.${ROOT_DOMAIN}`, "");
  }
};
export const siteIdentifierToUrl = (
  siteIdentifier: string,
  pathname: string,
  config: Config,
): string => {
  let port: number;
  if (siteIdentifier === "i") {
    // archive site
    port = config.archive.port || 9000;
  } else {
    const siteConfig = config.sites[siteIdentifier];
    port = siteConfig.port || 8000;
  }
  const isWorkersDev = Deno.env.get("WORKERS_DEV") === "1";
  if (isWorkersDev) {
    return `https://dev-${
      siteIdentifierToDomain(siteIdentifier, config.sites[siteIdentifier])
    }${pathname}`;
  } else if (isDev()) {
    return `http://localhost:${port}${pathname}`;
  } else {
    return `https://${
      siteIdentifierToDomain(siteIdentifier, config.sites[siteIdentifier])
    }${pathname}`;
  }
};
export const feedjsonUrlToRssUrl = (url: string) => {
  return url.replace("/feed.json", "/rss.xml");
};
export const urlToLanguageUrl = (url: string, languagePrefix: string) => {
  const urlInfo = getUrlLanguage(url);
  const urlObj = new URL(url);
  // check if url has a prefix
  urlObj.pathname = `/${languagePrefix}${urlInfo[1].slice(1)}`;
  return urlObj.toString();
};
export const getUrlLanguage = (
  url: string,
): [Language, string] => {
  const urlObj = new URL(url);
  // get language code
  const langField = urlObj.pathname.split("/")[1];
  // check if language code is valid
  let language = TARGET_SITE_LANGUAEGS[0];
  let pathname = urlObj.pathname;
  for (const targetLang of TARGET_SITE_LANGUAEGS) {
    let prefix = targetLang.prefix;
    // remove trailing slash
    if (prefix.endsWith("/")) {
      prefix = prefix.slice(0, -1);
    }
    if (prefix === langField) {
      language = targetLang;
      pathname = urlObj.pathname.slice(targetLang.prefix.length);
      break;
    }
  }
  return [language, pathname];
};
export const pathToSiteIdentifier = (path: string) => {
  return path;
};
export const arrayToObj = <T>(
  arr: Record<string, T>[],
  key = "id",
): Record<string, Record<string, T>> => {
  const obj: Record<string, Record<string, T>> = {};
  for (const item of arr) {
    obj[item[key] as unknown as string] = item;
  }
  return obj;
};
export const getItemTranslations = function (
  translations: Record<string, Record<string, string>>,
  languageCode: string,
  originalLanguageCode: string,
): Record<string, string> {
  return translations[languageCode] || translations[originalLanguageCode] || {};
};

// item.json -> /
// tags/show-hn/item.json -> /tags/show-hn/
export const itemsPathToURLPath = function (itemsPath: string) {
  const removedPath = itemsPath.replace(/items\.json$/, "");
  if (!removedPath.endsWith("/")) {
    return removedPath + "/";
  }
  if (!removedPath.startsWith("/")) {
    return "/" + removedPath;
  }
  return removedPath;
};

export const getPageMeta = (itemsRelativePath: string): PageMeta => {
  const pathArr = itemsRelativePath.split("/");
  let pageType = "index";
  let meta: Record<string, string> = {};
  if (pathArr.length >= 1) {
    const rootField = pathArr[0];
    if (rootField === "tags") {
      pageType = "tag";
      meta = {
        tagIdentifier: pathArr[1],
      };
    } else if (rootField === "archive") {
      pageType = "archive";
      meta = {
        year: pathArr[1],
        week: pathArr[2],
      };
    } else if (rootField === "issue") {
      pageType = "issue";
      meta = {
        year: pathArr[1],
        week: pathArr[2],
      };
    }
  }
  return {
    type: pageType,
    meta: meta,
  };
};

export const urlToFilePath = (url: string): string => {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;

  let filepath = pathname;

  if (pathname === "/") {
    filepath = "index.html";
  } else {
    filepath = pathname.slice(1);
  }
  if (filepath.endsWith("/")) {
    filepath += "index.html";
  } else {
    // check is has extension
    const basename = path.basename(filepath);
    if (!basename.includes(".")) {
      if (filepath.endsWith("/")) {
        filepath += "index.html";
      } else {
        filepath += "/index.html";
      }
    }
  }

  return filepath;
};
export const getArchiveS3Bucket = (bucket: string): S3Bucket => {
  const s3Bucket = new S3Bucket(
    {
      accessKeyID: Deno.env.get("ARCHIVE_ACCESS_KEY_ID")!,
      secretKey: Deno.env.get("ARCHIVE_SECRET_ACCESS_KEY")!,
      bucket: bucket,
      region: Deno.env.get("ARCHIVE_REGION")!,
      endpointURL: Deno.env.get("ARCHIVE_ENDPOINT")!,
    },
  );
  return s3Bucket;
};
export const getCurrentDataS3Bucket = (
  bucket: string,
): S3Bucket => {
  const s3Bucket = new S3Bucket(
    {
      accessKeyID: Deno.env.get("R2_ACCESS_KEY_ID")!,
      secretKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
      bucket: bucket,
      region: Deno.env.get("R2_REGION")!,
      endpointURL: Deno.env.get("R2_ENDPOINT")!,
    },
  );
  return s3Bucket;
};

export const loadS3ArchiveFile = async (fileRelativePath: string) => {
  const R2_BUCKET = getArchivedBucketName();
  const s3Bucket = getArchiveS3Bucket(R2_BUCKET);
  const object = await s3Bucket.headObject(fileRelativePath);
  if (object && object.etag) {
    const getObject = await s3Bucket.getObject(fileRelativePath);
    if (getObject) {
      const { body } = getObject;
      const data = await new Response(body).text();
      await writeTextFile(fileRelativePath, data);
    } else {
      throw new Error(`loadS3ArchiveFile: getObject is null`);
    }
  }
};

export function getCurrentBucketName() {
  const R2_BUCKET = isDev() ? "dev-feed" : "feed";
  return R2_BUCKET;
}
export function getArchivedBucketName() {
  const R2_BUCKET = isDev() ? "dev-feedarchive" : "feedarchive";
  return R2_BUCKET;
}
export function getArchiveSitePrefix(config: Config) {
  if (isDev()) {
    return `http://localhost:${config.archive.port}`;
  } else {
    return `https://${config.archive.siteIdentifier}.${ROOT_DOMAIN}`;
  }
}
export const getCurrentTranslations = function (
  siteIdentifier: string,
  languageCode: string,
  config: Config,
): Record<string, string> {
  let currentTranslations: Record<string, string> = {};
  const translations = config.translations;
  const sitesMap = config.sites;
  const siteConfig = sitesMap[siteIdentifier];

  // merge site translations
  const generalTranslations = translations[languageCode] ?? {};
  let siteTranslations = {};
  if (siteConfig.translations) {
    siteTranslations = siteConfig.translations[languageCode] ??
      siteConfig.translations["zh-Hans"] ?? {};
  }

  currentTranslations = {
    ...generalTranslations,
    ...siteTranslations,
  };

  return currentTranslations;
};
export const getGeneralTranslations = function (
  languageCode: string,
  config: Config,
) {
  let currentTranslations: Record<string, string> = {};
  const translations = config.translations;

  // merge site translations
  const generalTranslations = translations[languageCode] ?? {};

  currentTranslations = {
    ...generalTranslations,
  };

  return currentTranslations;
};
export const resortArchiveKeys = function (currentArchive: string[]): string[] {
  // write currentArchive file
  // resort currentArchive by time
  currentArchive = currentArchive.sort((a, b) => {
    const splited = a.split("/");
    const aYear = splited[0];
    const aWeek = addZero(Number(splited[1]));
    const aNum = Number("" + aYear + aWeek);

    const splited2 = b.split("/");
    const bYear = splited2[0];
    const bWeek = addZero(Number(splited2[1]));
    const bNum = Number("" + bYear + bWeek);

    return bNum - aNum;
  });
  return currentArchive;
};
export const addZero = function (num: number): string {
  if (num < 10) {
    return "0" + num;
  } else {
    return "" + num;
  }
};

export function weekOfYear(date: Date): WeekOfYear {
  const workingDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );

  const day = workingDate.getUTCDay();

  const nearestThursday = workingDate.getUTCDate() +
    Day.Thu -
    (day === Day.Sun ? DAYS_PER_WEEK : day);

  workingDate.setUTCDate(nearestThursday);

  // Get first day of year
  const yearStart = new Date(Date.UTC(workingDate.getUTCFullYear(), 0, 1));
  const weekYear = workingDate.getUTCFullYear();
  // return the calculated full weeks to nearest Thursday
  const week = Math.ceil(
    (workingDate.getTime() - yearStart.getTime() + DAY) / WEEK,
  );
  return {
    year: weekYear,
    week: week,
    path: `${workingDate.getUTCFullYear()}/${week}`,
    number: Number(`${weekYear}${addZero(week)}`),
  };
}
export const isWeekBiggerThan = function (aDate: Date, bDate: Date): boolean {
  const weekOfA = weekOfYear(aDate);
  const weekOfB = weekOfYear(bDate);
  if (weekOfA.number > weekOfB.number) {
    return true;
  }
  return false;
};
