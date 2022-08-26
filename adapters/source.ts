import { FormatedItem, Link, Video } from "../interface.ts";
import Item from "../item.ts";
import { parseItemIdentifier } from "../util.ts";
export default class source extends Item<FormatedItem> {
  getSensitive(): boolean {
    return this.originalItem._sensitive || false;
  }
  getOriginalPublishedDate(): Date {
    return new Date(this.originalItem._original_published as string);
  }
  getItemIdentifier(): string {
    return this.originalItem.id as string;
  }
  getOriginalLanguage(): string {
    return this.originalItem._original_language || "en";
  }
  getId(): string {
    const parsedId = parseItemIdentifier(this.originalItem.id);
    return parsedId.id;
  }
  getTitle(): string {
    const language = this.originalItem._original_language;
    if (this.originalItem._translations) {
      if (this.originalItem._translations[language]) {
        return this.originalItem._translations[language].title;
      }
    }
    return "";
  }
  getTitlePrefix(): string {
    return this.originalItem._title_prefix || "";
  }
  getTitleSuffix(): string {
    return this.originalItem._title_suffix || "";
  }

  getUrl(): string {
    return this.originalItem.url as string;
  }
  getExternalUrl() {
    return this.originalItem.external_url;
  }
  getAuthors() {
    return this.originalItem.authors || [];
  }
  getScore() {
    return this.originalItem._score || 0;
  }
  getNumComments() {
    return this.originalItem._num_comments || 0;
  }
  getImage(): string | null {
    return this.originalItem.image || null;
  }
  getVideo(): Video | undefined {
    return this.originalItem._video;
  }
  getTags() {
    return this.originalItem.tags || [];
  }
  getType(): string {
    const id = this.getItemIdentifier();
    const parsedId = parseItemIdentifier(id);
    return parsedId.type;
  }
  isText(): boolean {
    const type = this.getType();
    if (type === "twitter") {
      return true;
    }
    return false;
  }
  getFullTranslations(): Record<string, Record<string, string>> | undefined {
    if (this.originalItem._translations) {
      return this.originalItem._translations;
    } else {
      return undefined;
    }
  }
  getLinks(): Link[] {
    const type = this.getType();
    const links: Link[] = [];
    const externalLink = this.getExternalUrl();
    let externalLinkName = "";
    if (type === "hn") {
      if (this.getScore()) {
        externalLinkName = `&uarr; ${this.getScore()} HN Points`;
      } else {
        externalLinkName = "HN Link";
      }
    } else if (type === "reddit") {
      if (this.getScore() && this.getExternalUrl()) {
        externalLinkName = `&uarr; ${this.getScore()} Reddit Upvotes`;
      } else {
        externalLinkName = `Reddit Link`;
      }
    } else if (type === "twitter") {
      if (
        this.getScore() && this.getExternalUrl()
      ) {
        externalLinkName = `&uarr; ${this.getScore()} Twitter Like`;
      } else {
        externalLinkName = `Twitter Link`;
      }
    }

    if (externalLink && externalLinkName) {
      links.push({
        url: externalLink,
        name: externalLinkName,
      });
    }
    return links;
  }
}
