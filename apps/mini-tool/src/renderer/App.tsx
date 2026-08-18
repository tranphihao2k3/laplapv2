import * as React from "react";
import {
  Link2,
  Cpu,
  Gauge,
  Wrench,
  ClipboardCheck,
  Send,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/Header";
import { SessionStoreProvider } from "@/store";
import { ConnectTab } from "@/pages/ConnectTab";
import { HardwareTab } from "@/pages/HardwareTab";
import { BenchmarkTab } from "@/pages/BenchmarkTab";
import { OptimizeTab } from "@/pages/OptimizeTab";
import { TestTab } from "@/pages/TestTab";
import { UploadTab } from "@/pages/UploadTab";

export function App() {
  const [appVersion, setAppVersion] = React.useState("0.1.0");

  React.useEffect(() => {
    void window.lap.upload
      .status()
      .then((res) => {
        if (res.ok && res.data?.appVersion) setAppVersion(res.data.appVersion);
      })
      .catch(() => undefined);
  }, []);

  return (
    <SessionStoreProvider>
      <TooltipProvider delayDuration={150}>
        <div className="flex min-h-screen flex-col bg-background text-foreground">
          <Header appVersion={appVersion} />

          <main className="container flex-1 py-5">
            <Tabs defaultValue="connect" className="space-y-5">
              <TabsList className="flex h-auto w-full flex-wrap gap-1 p-1">
                <TabsTrigger value="connect" className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" /> Kết nối
                </TabsTrigger>
                <TabsTrigger value="hardware" className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" /> Phần cứng
                </TabsTrigger>
                <TabsTrigger value="benchmark" className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5" /> Benchmark
                </TabsTrigger>
                <TabsTrigger value="test" className="flex items-center gap-1.5">
                  <ClipboardCheck className="h-3.5 w-3.5" /> Kiểm tra
                </TabsTrigger>
                <TabsTrigger value="optimize" className="flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" /> Tối ưu
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Tải lên
                </TabsTrigger>
              </TabsList>

              <TabsContent value="connect">
                <ConnectTab />
              </TabsContent>
              <TabsContent value="hardware">
                <HardwareTab />
              </TabsContent>
              <TabsContent value="benchmark">
                <BenchmarkTab />
              </TabsContent>
              <TabsContent value="test">
                <TestTab />
              </TabsContent>
              <TabsContent value="optimize">
                <OptimizeTab />
              </TabsContent>
              <TabsContent value="upload">
                <UploadTab />
              </TabsContent>
            </Tabs>
          </main>

          <footer className="border-t border-border/60 px-4 py-2 text-center text-[10px] text-muted-foreground">
            LapLap Mini Tool · Giao tiếp qua {window.lap.platform} · {appVersion}
          </footer>
          <Toaster position="top-right" />
        </div>
      </TooltipProvider>
    </SessionStoreProvider>
  );
}

export default App;