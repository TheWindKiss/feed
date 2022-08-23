import { Browser, Page, puppeteer } from "./bad-deps.ts";
import { isMock } from "./util.ts";
import log from "./log.ts";
import { YAML } from "./deps.ts";
import { TranslationOptions } from "./interface.ts";
import { TRANSLATED_ITEMS_PER_PAGE } from "./constant.ts";
import { toZhHant } from "./to-zh-hant.ts";
const homepage = "https://www.deepl.com/en/translator-mobile";
const sourceLangSelect = "button[dl-test=translator-source-lang-btn]",
  targetLangSelect = "button[dl-test=translator-target-lang-btn]",
  sourceLangMenu = "div[dl-test=translator-source-lang-list]",
  targetLangMenu = "div[dl-test=translator-target-lang-list]",
  originalSentenceField = "textarea[dl-test=translator-source-input]",
  targetSentenceField = "textarea[dl-test=translator-target-input]";
export default class Translation {
  browser: Browser | null = null;
  page: Page | null = null;
  private currentTranslated = 0;
  private isMock = isMock();
  private countPerPage = TRANSLATED_ITEMS_PER_PAGE;
  private currentSourceLanguage = "";
  private currentTargetLanguage = "";
  private localTranslations: Record<string, Record<string, string>> = {};
  constructor(options: TranslationOptions = {}) {
    if (options.isMock !== undefined) {
      this.isMock = options.isMock;
    }

    if (options.countPerPage !== undefined) {
      this.countPerPage = options.countPerPage;
    }
  }
  async init() {
    if (this.isMock) {
      log.info("mock mode: init puppeteer page success");
      return;
    }
    // try to load i18n local translation files

    for await (const dirEntry of Deno.readDir("./i18n")) {
      if (dirEntry.isFile) {
        const filename = dirEntry.name;
        const language = filename.replace(/\.yml$/, "");
        const fileContent = await Deno.readTextFile(`./i18n/${filename}`);
        this.localTranslations[language] = YAML.parse(fileContent) as Record<
          string,
          string
        >;
      }
    }

    this.currentSourceLanguage = "";
    this.currentTargetLanguage = "";
    // init puppeteer
    const isHeadless = !(Deno.env.get("HEADLESS") === "0");
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        devtools: true,
        // defaultViewport: null,
        headless: isHeadless, // !isDev,
        defaultViewport: {
          width: 393,
          height: 851,
          // deviceScaleFactor: 2,
          isMobile: true,
        },
        args: ["--lang=zh-Hans,zh", "--disable-gpu", "--no-sandbox"],
      });
      this.browser.on("disconnected", () => (this.browser = null));
    }
    if (!this.page) {
      const pages = await this.browser.pages();
      if (pages[0]) {
        this.page = pages[0];
      } else {
        this.page = await this.browser.newPage();
      }

      await this.page.setUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
      );

      this.page.setExtraHTTPHeaders({ referer: "https://www.google.com/" });

      await this.page.goto(homepage, { waitUntil: "domcontentloaded" });

      await this.page.waitForXPath(
        "//span[@data-testid='deepl-ui-tooltip-target']",
      );
    }
    log.info("init puppeteer page success");
  }

  async translate(
    sentence: string,
    sourceLanguage: string,
    targetLanguages: string[],
  ): Promise<Record<string, string>> {
    // if mock
    const finalTranslatedResult: Record<string, string> = {};
    for (const targetLanguage of targetLanguages) {
      finalTranslatedResult[targetLanguage] = sentence;
    }
    if (this.isMock) {
      return finalTranslatedResult;
    }
    if (!this.page) {
      throw new Error("page not init, must call init() first");
    }

    // if current translated count if greater than 10, close page and init again
    if (this.currentTranslated >= this.countPerPage) {
      await this.page.close();
      this.page = null;
      await this.init();
      this.currentTranslated = 0;
    }
    const translated = await this.doTranslate(
      this.page!,
      sentence,
      sourceLanguage,
      targetLanguages,
      true,
      {},
    );
    return translated;
  }
  static getTargetButtonSelector(targetLanguage: string) {
    const targetButtonSelector =
      `button[dl-test=translator-lang-option-${targetLanguage}]`;
    return targetButtonSelector;
  }
  static toDeeplLanguage(targetLanguage: string) {
    let deepTargetLanguage = targetLanguage;
    if (targetLanguage.startsWith("zh")) {
      deepTargetLanguage = "zh";
    }
    return deepTargetLanguage;
  }
  async doTranslate(
    page: Page,
    sentence: string,
    sourceLanguage = "auto",
    targetLanguages: string[],
    isNeedInit: boolean,
    current: Record<string, string>,
  ): Promise<Record<string, string>> {
    const finalTranslatedResult: Record<string, string> = current || {};
    for (const targetLanguage of targetLanguages) {
      finalTranslatedResult[targetLanguage] = sentence;
    }
    if (this.isMock) {
      return finalTranslatedResult;
    }
    if (targetLanguages.length < 1) {
      log.warn(
        `targetLanguages is empty, sentence: ${sentence}, sourceLanguage: ${sourceLanguage}`,
      );
      throw new Error("targetLanguages must have at least one language");
    }
    const targetLanguage = targetLanguages[0];
    const todoLanguages = targetLanguages.slice(1);

    // check local translate
    const localTranslation = this.localTranslations[targetLanguage];
    if (localTranslation && localTranslation[sentence]) {
      log.info(
        `local translate ${sentence} to ${targetLanguage} ${
          localTranslation[sentence]
        } success`,
      );
      finalTranslatedResult[targetLanguage] = localTranslation[sentence];
      if (todoLanguages.length > 0) {
        return {
          ...finalTranslatedResult,
          ...await this.doTranslate(
            page,
            sentence,
            sourceLanguage,
            todoLanguages,
            isNeedInit,
            finalTranslatedResult,
          ),
        };
      } else {
        return finalTranslatedResult;
      }

      // todo
    }

    // check zh-Hant
    if (targetLanguage === "zh-Hant") {
      if (!finalTranslatedResult["zh-Hans"]) {
        throw new Error("zh-Hans must be translated before zh-Hant");
      }
      finalTranslatedResult[targetLanguage] = toZhHant(
        finalTranslatedResult["zh-Hans"],
      );
      if (todoLanguages.length > 0) {
        return {
          ...finalTranslatedResult,
          ...await this.doTranslate(
            page,
            sentence,
            sourceLanguage,
            todoLanguages,
            isNeedInit,
            finalTranslatedResult,
          ),
        };
      } else {
        return finalTranslatedResult;
      }
    }

    // max 5000
    if (sentence.length > 4500) {
      sentence = sentence.substring(0, 4500);
    }
    if (!/^(auto|[a-z]{2})$/.test(sourceLanguage)) {
      throw new Error("INVALID_SOURCE_LANGUAGE");
    }
    if (!/^[a-z]{2}$/.test(Translation.toDeeplLanguage(targetLanguage))) {
      throw new Error("INVALID_TARGET_LANGUAGE");
    }

    const sourceLangButton =
      `button[dl-test=translator-lang-option-${sourceLanguage}]`;
    if (isNeedInit) {
      isNeedInit = false;
      if (this.currentSourceLanguage !== sourceLanguage) {
        // click  black
        // await page.screenshot({ path: "data/1.png" });
        // console.log("click");
        await page.waitForSelector(sourceLangSelect, { visible: true });

        await page.click(sourceLangSelect);
        await page.waitForTimeout(500);

        await page.waitForSelector(sourceLangMenu, { visible: true });
        await page.waitForTimeout(500);

        try {
          await page.click(sourceLangButton);
        } catch (_) {
          throw new Error("UNSUPPORTED_SOURCE_LANGUAGE");
        }
        // await page.screenshot({ path: "screens/3.png" });

        await page.waitForSelector(sourceLangMenu, { hidden: true });
        this.currentSourceLanguage = sourceLanguage;
      }
      await this.changeTargetLanguage(
        Translation.toDeeplLanguage(targetLanguage),
      );
      // console.log("wait original");

      await page.waitForSelector(originalSentenceField);
      // console.log("start type", sentence);
      await page.$eval(
        originalSentenceField,
        (el, sentence) => (el.value = sentence),
        sentence,
      );
      await page.waitForTimeout(1500);

      // await page.keyboard.press("Enter");

      const textInputElement = await page.$(originalSentenceField);
      if (!textInputElement) {
        throw new Error("CANNOT_FIND_ORIGINAL_SENTENCE_FIELD");
      }
      await textInputElement.press("Enter"); // Enter Key
    }
    await this.changeTargetLanguage(
      Translation.toDeeplLanguage(targetLanguage),
    );
    // wait for copy button
    await page.waitForSelector(
      "button[aria-label='Copy to clipboard']",
      { visible: true },
    );

    let result: string = await page.$eval(
      targetSentenceField,
      (el) => el.value,
    ) as unknown as string;
    result = (result as unknown as string).replace(/\n$/, "");
    finalTranslatedResult[targetLanguage] = result as unknown as string;

    // check is other todo languages
    if (todoLanguages.length > 0) {
      return {
        ...finalTranslatedResult,
        ...await this.doTranslate(
          page,
          sentence,
          sourceLanguage,
          todoLanguages,
          isNeedInit,
          finalTranslatedResult,
        ),
      };
    }

    const elements = await page.$x(
      "//span[text()='Delete source text']/parent::button",
    );
    await elements[0].click();

    await page.waitForTimeout(1000);

    return finalTranslatedResult;
  }
  async changeTargetLanguage(targetLanguage: string) {
    if (this.currentTargetLanguage !== targetLanguage) {
      const page = this.page!;
      await page.click(targetLangSelect);
      await page.waitForTimeout(1000);

      await page.waitForSelector(targetLangMenu, { visible: true });

      await page.waitForTimeout(1000);
      try {
        await page.click(Translation.getTargetButtonSelector(targetLanguage));
      } catch (_) {
        throw new Error("UNSUPPORTED_TARGET_LANGUAGE");
      }
      this.currentTargetLanguage = targetLanguage;
    }
  }

  async close() {
    if (this.page) {
      await this.page.close();
    }
    // quit puppeteer
    if (this.browser) {
      await (this.browser as Browser)!.close();
    }
  }
}
