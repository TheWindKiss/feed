import { jsonfeedToAtom, jsonfeedToRSS, path } from "../deps.ts";
import { ItemsJson, RunOptions } from "../interface.ts";
import itemsToFeed from "../items-to-feed.ts";
import {
  getChangedSitePaths,
  getCurrentItemsFilePath,
  getDataCurrentItemsPath,
  getDistFilePath,
  getDistPath,
  isDev,
  pathToSiteIdentifier,
  readJSONFile,
  siteIdentifierToPath,
  writeJSONFile,
  writeTextFile,
} from "../util.ts";
import generateIcons from "../generate-icons.ts";
import log from "../log.ts";
import { TARGET_SITE_LANGUAEGS } from "../constant.ts";
import feedToHTML from "../feed-to-html.ts";
import generateRedirects from "../generate-redirects.ts";
export default async function buildSite(options: RunOptions) {
  const config = options.config;
  const currentDataPath = getDataCurrentItemsPath();
  let siteIdentifiers: string[] = [];
  const indexTemplateString = await Deno.readTextFile(
    "./templates/index.html.mu",
  );
  let changedSites: string[] | undefined;
  try {
    const changedSitesPath = getChangedSitePaths();
    changedSites = await readJSONFile(changedSitesPath);
  } catch (e) {
    log.debug(`read changedSitesPath json file error:`, e);
  }
  if (changedSites && !isDev()) {
    log.info(`got changed sites: ${changedSites}`);
    siteIdentifiers = changedSites;
  } else {
    log.info(`no changed sites file, scan all sites`);

    for await (const dirEntry of Deno.readDir(currentDataPath)) {
      if (dirEntry.isDirectory && !dirEntry.name.startsWith(".")) {
        // only build changed folder

        siteIdentifiers.push(pathToSiteIdentifier(dirEntry.name));
      }
    }
  }

  const sites = options.siteIdentifiers;
  if (sites && Array.isArray(sites)) {
    siteIdentifiers = siteIdentifiers.filter((siteIdentifier) => {
      return (sites as string[]).includes(siteIdentifier);
    });
  }

  // clear dist folder
  try {
    await Deno.remove(getDistPath(), { recursive: true });
  } catch (_e) {
    // ignore
  }
  let siteOrder = 0;
  for (const siteIdentifier of siteIdentifiers) {
    siteOrder++;
    const currentItemsFilePath = getCurrentItemsFilePath(
      siteIdentifier,
    );
    const itemsRelativePath = path.relative(
      `${getDataCurrentItemsPath()}/${siteIdentifierToPath(siteIdentifier)}`,
      currentItemsFilePath,
    );
    let currentItemsJson: ItemsJson = { items: {} };
    try {
      currentItemsJson = await readJSONFile(
        currentItemsFilePath,
      );
    } catch (_e) {
      // ignore
    }

    //check if need to archive items
    const currentItemsJsonKeys = Object.keys(
      currentItemsJson,
    );

    if (currentItemsJsonKeys.length > 0) {
      // multiple languages support
      const languages = TARGET_SITE_LANGUAEGS;
      const versions = config.versions;
      for (const language of languages) {
        for (const version of versions) {
          const feedJson = itemsToFeed(
            `/`,
            currentItemsJson,
            siteIdentifier,
            language.code,
            config,
            {
              versionCode: version.code,
            },
          );
          // write to dist file
          const feedPath = getDistFilePath(
            siteIdentifier,
            `${language.prefix}${version.prefix}feed.json`,
          );
          await writeJSONFile(feedPath, feedJson);

          // format summary, content_text newline with <br>

          feedJson.items = feedJson.items.map((item) => {
            item.summary = item.summary.replace(/\n/g, "&lt;br&gt;");
            item.content_text = item.content_text.replace(/\n/g, "&lt;br&gt;");
            return item;
          });

          // build atom.xml
          // no need
          // @ts-ignore: npm module
          // const atomOutput = jsonfeedToAtom(feedJson);
          // write to dist file
          // const atomPath = getDistFilePath(
          //   siteIdentifier,
          //   `${language.prefix}atom.xml`,
          // );
          // await writeTextFile(atomPath, atomOutput);

          // build feed.xml
          // @ts-ignore: npm module
          const feedOutput = jsonfeedToAtom(feedJson, {
            language: feedJson.language,
          });
          // const rssOutput = "";
          // write to dist file
          const rssPath = getDistFilePath(
            siteIdentifier,
            `${language.prefix}${version.prefix}feed.xml`,
          );
          await writeTextFile(rssPath, feedOutput);

          const indexPath = getDistFilePath(
            siteIdentifier,
            `${language.prefix}${version.prefix}index.html`,
          );
          const indexHTML = await feedToHTML(
            feedJson,
            config,
            indexTemplateString,
          );
          await writeTextFile(indexPath, indexHTML);

          // copy static files
          try {
            await generateIcons(siteIdentifier);
          } catch (e) {
            log.error("can not generate icons for ", siteIdentifier);
            throw e;
          }
        }
      }
      log.info(
        `${siteOrder}/${siteIdentifiers.length} ${siteIdentifier} build success`,
      );
    } else {
      log.info(
        `skip build ${siteIdentifier}, cause no items to be build`,
      );
    }

    // generate redirects for old sites
    await generateRedirects(siteIdentifier, config);

    // latest item date_modified is greater Monday
    // we will run archive task, try to archive all items of their week
  }
}
