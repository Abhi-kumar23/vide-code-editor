import type {
  TemplateFile,
  TemplateFolder,
} from "@/modules/playground/lib/path-to-json";

type TemplateItem = TemplateFile | TemplateFolder;


function getName(item: TemplateItem) {
  if (isFolder(item)) return item.folderName;
  return item.fileExtension
  ? `${item.filename}.${item.fileExtension}`
  : item.filename;
}


interface WebContainerFile {
  file: {
    contents: string;
  };
}

interface WebContainerDirectory {
  directory: {
    [key: string]: WebContainerFile | WebContainerDirectory;
  };
}

type WebContainerFileSystem = Record<string, WebContainerFile | WebContainerDirectory>;

function isFolder(item: TemplateItem): item is TemplateFolder {
  return "items" in item && Array.isArray(item.items);
}

export function transformToWebContainerFormat(
  template: TemplateFolder,
): WebContainerFileSystem {
  const toEntry = (
    item: TemplateItem,
  ): WebContainerFile | WebContainerDirectory => {
    if (!isFolder(item)) {
      return {
        file: {
          contents: item.content,
        },
      };
    }

    return {
      directory: Object.fromEntries(
        item.items.map((child) => [getName(child), toEntry(child)]),
      ),
    };
  };

  return Object.fromEntries(
    template.items.map((item) => [getName(item), toEntry(item)]),
  );
}
