import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { HomepageHeroSetting } from "@/lib/homepage-hero";

type SettingRow = {
  key: string | null;
  group_name: string | null;
  value: unknown;
};

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("settings")
      .select("key,group_name,value")
      .eq("key", "homepage.hero")
      .single();

    if (error || !data) {
      return NextResponse.json({ template: 0 } as HomepageHeroSetting);
    }

    const row = data as SettingRow;
    let setting: HomepageHeroSetting | undefined;
    if (typeof row.value === "string") {
      try {
        setting = JSON.parse(row.value) as HomepageHeroSetting;
      } catch {
        setting = undefined;
      }
    } else if (typeof row.value === "object" && row.value !== null) {
      setting = row.value as HomepageHeroSetting;
    }

    return NextResponse.json(setting ?? ({ template: 0 } as HomepageHeroSetting));
  } catch {
    return NextResponse.json({ template: 0 } as HomepageHeroSetting);
  }
}
