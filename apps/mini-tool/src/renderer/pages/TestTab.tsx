import * as React from "react";
import { Volume2, Image as ImageIcon, Keyboard, Mic, Camera, VolumeX } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SpeakerTester } from "./test/SpeakerTester";
import { DisplayTester } from "./test/DisplayTester";
import { KeyboardTester } from "./test/KeyboardTester";
import { MicTester } from "./test/MicTester";
import { CameraTester } from "./test/CameraTester";

export function TestTab() {
  return (
    <div className="space-y-5">
      <Tabs defaultValue="speaker" className="w-full">
        <TabsList className="flex h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="speaker" className="flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5" /> Loa
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> Màn hình
          </TabsTrigger>
          <TabsTrigger value="keyboard" className="flex items-center gap-1.5">
            <Keyboard className="h-3.5 w-3.5" /> Bàn phím
          </TabsTrigger>
          <TabsTrigger value="mic" className="flex items-center gap-1.5">
            <Mic className="h-3.5 w-3.5" /> Micro
          </TabsTrigger>
          <TabsTrigger value="camera" className="flex items-center gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Camera
          </TabsTrigger>
          <TabsTrigger value="mute" disabled className="opacity-40">
            <VolumeX className="h-3.5 w-3.5" /> Touchpad (sắp có)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="speaker" className="mt-4">
          <SpeakerTester />
        </TabsContent>
        <TabsContent value="display" className="mt-4">
          <DisplayTester />
        </TabsContent>
        <TabsContent value="keyboard" className="mt-4">
          <KeyboardTester />
        </TabsContent>
        <TabsContent value="mic" className="mt-4">
          <MicTester />
        </TabsContent>
        <TabsContent value="camera" className="mt-4">
          <CameraTester />
        </TabsContent>
      </Tabs>
    </div>
  );
}