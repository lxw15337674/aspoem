import { CirclePlusIcon, DicesIcon } from "lucide-react";

export interface SidebarItem {
  title: string;
  icon?: React.ElementType;
  url: string;
  defaultOpen?: boolean;
  isActive?: boolean;
  items?: SidebarItem[];
  description?: string;
}

export const discover: SidebarItem[] = [
  {
    title: "最近更新",
    icon: CirclePlusIcon,
    description: "查看最近更新的诗文",
    url: "/poems",
  },
  {
    title: "随机诗文",
    icon: DicesIcon,
    description: "点击按钮，可以随机一首诗文",
    url: "/poems/random",
  },
];
