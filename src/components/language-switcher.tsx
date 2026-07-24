"use client";

import { LanguagesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isLocale, localeOptions, locales } from "@/i18n/dictionaries";
import { useLocale } from "@/i18n/provider";

export function LanguageSwitcher() {
  const { dictionary, locale, setLocale } = useLocale();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={dictionary.menu.language}
            >
              <LanguagesIcon className="size-5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{dictionary.menu.language}</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{dictionary.menu.language}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => {
            if (isLocale(value)) setLocale(value);
          }}
        >
          {locales.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {localeOptions[option].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
