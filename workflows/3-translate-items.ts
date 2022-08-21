import { fs, path } from "../deps.ts";
import { FormatedItem, RunOptions } from "../interface.ts";
import Item from "../item.ts";
import {
  getDataFormatedPath,
  isDev,
  pathToSiteIdentifier,
  siteIdentifierToPath,
  writeJSONFile,
} from "../util.ts";
import log from "../log.ts";
import Translation from "../translate.ts";
import { DEV_MODE_HANDLED_ITEMS, TARGET_SITE_LANGUAEGS } from "../constant.ts";

export default async function translateItems(
  options: RunOptions,
) {
  // get all 2-formated files
  // is exists formated files folder
  await fs.ensureDir(getDataFormatedPath());
  const config = options.config;
  let siteIdentifiers: string[] = [];

  for await (const dirEntry of Deno.readDir(getDataFormatedPath())) {
    if (dirEntry.isDirectory && !dirEntry.name.startsWith(".")) {
      siteIdentifiers.push(pathToSiteIdentifier(dirEntry.name));
    }
  }
  const sites = options.siteIdentifiers;
  if (sites && Array.isArray(sites)) {
    siteIdentifiers = siteIdentifiers.filter((siteIdentifier) => {
      return (sites as string[]).includes(siteIdentifier);
    });
  }
  if (siteIdentifiers.length > 0) {
    // yes
    // start instance
    const translation = new Translation();
    await translation.init();

    for (const siteIdentifier of siteIdentifiers) {
      let total = 0;
      const files: string[] = [];
      try {
        let totalFiles = 0;
        for await (
          const entry of fs.walk(
            getDataFormatedPath() + "/" + siteIdentifierToPath(siteIdentifier),
          )
        ) {
          if (isDev()) {
            if (totalFiles >= DEV_MODE_HANDLED_ITEMS) {
              log.info(`dev mode, only take ${DEV_MODE_HANDLED_ITEMS} files`);
              break;
            }
          }
          if (entry.isFile && entry.path.endsWith(".json")) {
            files.push(entry.path);
            totalFiles += 1;
          }
        }
      } catch (e) {
        throw e;
      }
      if (files.length > 0) {
        for (const file of files) {
          const item = JSON.parse(
            await Deno.readTextFile(file),
          ) as FormatedItem;
          const filename = path.basename(file);
          const parsedFilename = Item.parseItemIdentifier(filename, config);
          const originalTranslations = (item._translations
            ? item
              ._translations[item._original_language]
            : {}) as Record<string, string>;
          const originalTranslationKeys = Object.keys(originalTranslations);
          let translations = {
            ...item._translations,
          };
          const translatedJson = {
            ...item,
          } as Record<string, unknown>;
          for (const field of originalTranslationKeys) {
            // first check if this field is translated
            const todoLanguages = [];
            for (const language of TARGET_SITE_LANGUAEGS) {
              if (language.code === item._original_language) {
                continue;
              }

              if (
                translations[language.code] &&
                translations[language.code][field] !== undefined
              ) {
                // yes already translated
                log.debug(`field ${field} already translated, skip`);
                continue;
              }

              todoLanguages.push(language);
            }

            const value = originalTranslations[field];
            log.debug(
              `translating ${parsedFilename.type} ${parsedFilename.language} ${field}: ${value} for ${parsedFilename.targetSite}`,
            );
            const translated = await translation.translate(
              value,
              item._original_language,
              todoLanguages.map((item) => item.code),
            );
            for (const languageCode of Object.keys(translated)) {
              if (!translations[languageCode]) {
                translations[languageCode] = {};
              }
              translations[languageCode][field] = translated[languageCode];
            }
          }
          translatedJson._translations = translations;

          // write translated item to file
          const translatedPath = Item.getTranslatedPath(filename, config);

          await writeJSONFile(
            translatedPath,
            translatedJson,
          );
          // remove formated file
          await Deno.remove(file);

          total += 1;
        }

        // close instance
        log.info(`translated ${total} items`);
      }
    }
    await translation.close();
  }
}
