import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Save, RefreshCw, ShieldAlert } from "lucide-react";

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [aiServiceStatus, setAiServiceStatus] = useState<{
    hasValidKeys: boolean;
    availableModels: string[];
  }>({ hasValidKeys: false, availableModels: [] });

  // General settings state
  const [generalSettings, setGeneralSettings] = useState({
    platformName: "AI Agent Platform",
    autoStartAgents: true,
    enableA2A: true,
    developerMode: false,
  });

  // API settings state
  const [apiSettings, setApiSettings] = useState({
    openaiApiKey: "",
    anthropicApiKey: "",
    huggingfaceApiKey: "",
    googleApiKey: "",
  });

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        // Load general settings
        const storedGeneral = localStorage.getItem("generalSettings");
        if (storedGeneral) {
          setGeneralSettings(JSON.parse(storedGeneral));
        }

        // Load API settings
        const storedApi = localStorage.getItem("apiSettings");
        if (storedApi) {
          const parsedApi = JSON.parse(storedApi);
          setApiSettings({
            openaiApiKey: parsedApi.openaiApiKey || "",
            anthropicApiKey: parsedApi.anthropicApiKey || "",
            huggingfaceApiKey: parsedApi.huggingfaceApiKey || "",
            googleApiKey: parsedApi.googleApiKey || "",
          });
        }

        // Load security settings
        const storedSecurity = localStorage.getItem("securitySettings");
        if (storedSecurity) {
          setSecuritySettings(JSON.parse(storedSecurity));
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();

    // Check AI service status
    const checkAIServiceStatus = async () => {
      try {
        const { AIService } = await import("../../lib/ai-service");
        const hasValidKeys = AIService.hasValidApiKeys();
        const availableModels = AIService.getAvailableModels();
        setAiServiceStatus({ hasValidKeys, availableModels });
      } catch (error) {
        console.error("Error checking AI service status:", error);
      }
    };

    checkAIServiceStatus();
  }, []);

  // Security settings state
  const [securitySettings, setSecuritySettings] = useState({
    requireAuth: false,
    allowExternalApi: true,
    allowCrossAgentComm: true,
    logSensitiveData: false,
  });

  // Handle form changes
  const handleGeneralSettingsChange = (key: string, value: any) => {
    setGeneralSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleApiSettingsChange = (key: string, value: string) => {
    setApiSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSecuritySettingsChange = (key: string, value: any) => {
    setSecuritySettings((prev) => ({ ...prev, [key]: value }));
  };

  // Handle settings save
  const handleSaveSettings = async (settingsType: string) => {
    setIsLoading(true);

    try {
      switch (settingsType) {
        case "general":
          localStorage.setItem(
            "generalSettings",
            JSON.stringify(generalSettings)
          );
          break;
        case "api":
          localStorage.setItem("apiSettings", JSON.stringify(apiSettings));
          // Update AI service configuration
          const { AIService } = await import("../../lib/ai-service");
          AIService.updateConfig({
            openaiApiKey: apiSettings.openaiApiKey,
            anthropicApiKey: apiSettings.anthropicApiKey,
            huggingfaceApiKey: apiSettings.huggingfaceApiKey,
            googleApiKey: apiSettings.googleApiKey,
          });

          // Update status
          const hasValidKeys = AIService.hasValidApiKeys();
          const availableModels = AIService.getAvailableModels();
          setAiServiceStatus({ hasValidKeys, availableModels });
          break;
        case "security":
          localStorage.setItem(
            "securitySettings",
            JSON.stringify(securitySettings)
          );
          break;
      }

      // Show success message (you could use a toast here)
      console.log(`${settingsType} settings saved`);
    } catch (error) {
      console.error(`Error saving ${settingsType} settings:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle clear all data
  const handleClearAllData = () => {
    // List of keys to keep (e.g. settings)
    const keysToKeep = ["generalSettings", "apiSettings", "securitySettings"];

    // Get all keys from localStorage
    const allKeys = Object.keys(localStorage);

    // Delete keys except those to keep
    allKeys.forEach((key) => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    // Reload the page to reflect changes
    window.location.reload();
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure your AI Agent Platform.
          </p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="data">Data Management</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Configure basic platform behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platformName">Platform Name</Label>
                <Input
                  id="platformName"
                  value={generalSettings.platformName}
                  onChange={(e) =>
                    handleGeneralSettingsChange("platformName", e.target.value)
                  }
                />
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Start Agents</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically start agents when the platform loads
                    </p>
                  </div>
                  <Switch
                    checked={generalSettings.autoStartAgents}
                    onCheckedChange={(checked) =>
                      handleGeneralSettingsChange("autoStartAgents", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Agent-to-Agent Communication</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow agents to communicate with each other
                    </p>
                  </div>
                  <Switch
                    checked={generalSettings.enableA2A}
                    onCheckedChange={(checked) =>
                      handleGeneralSettingsChange("enableA2A", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Developer Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable advanced features and debug options
                    </p>
                  </div>
                  <Switch
                    checked={generalSettings.developerMode}
                    onCheckedChange={(checked) =>
                      handleGeneralSettingsChange("developerMode", checked)
                    }
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={() => handleSaveSettings("general")}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Configure API keys for various services.
              </CardDescription>
              <div className="mt-2">
                <div
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    aiServiceStatus.hasValidKeys
                      ? "bg-green-100 text-green-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full mr-2 ${
                      aiServiceStatus.hasValidKeys
                        ? "bg-green-500"
                        : "bg-yellow-500"
                    }`}
                  />
                  {aiServiceStatus.hasValidKeys
                    ? "AI Service Available"
                    : "No API Keys Configured"}
                </div>
                {aiServiceStatus.hasValidKeys &&
                  aiServiceStatus.availableModels.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Available models:{" "}
                      {aiServiceStatus.availableModels.slice(0, 3).join(", ")}
                      {aiServiceStatus.availableModels.length > 3 && "..."}
                    </p>
                  )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                <Input
                  id="openaiApiKey"
                  type="password"
                  value={apiSettings.openaiApiKey}
                  onChange={(e) =>
                    handleApiSettingsChange("openaiApiKey", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Used for GPT models and embeddings
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="anthropicApiKey">Anthropic API Key</Label>
                <Input
                  id="anthropicApiKey"
                  type="password"
                  value={apiSettings.anthropicApiKey}
                  onChange={(e) =>
                    handleApiSettingsChange("anthropicApiKey", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Used for Claude models
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="huggingfaceApiKey">Hugging Face API Key</Label>
                <Input
                  id="huggingfaceApiKey"
                  type="password"
                  value={apiSettings.huggingfaceApiKey}
                  onChange={(e) =>
                    handleApiSettingsChange("huggingfaceApiKey", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Used for open-source models
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="googleApiKey">Google API Key</Label>
                <Input
                  id="googleApiKey"
                  type="password"
                  value={apiSettings.googleApiKey}
                  onChange={(e) =>
                    handleApiSettingsChange("googleApiKey", e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Used for Google AI models and services
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={() => handleSaveSettings("api")}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Keys
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure security and permissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Require login to access the platform
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.requireAuth}
                    onCheckedChange={(checked) =>
                      handleSecuritySettingsChange("requireAuth", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow External API Access</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow agents to access external APIs
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.allowExternalApi}
                    onCheckedChange={(checked) =>
                      handleSecuritySettingsChange("allowExternalApi", checked)
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Cross-Agent Communication</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow agents to communicate with each other
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.allowCrossAgentComm}
                    onCheckedChange={(checked) =>
                      handleSecuritySettingsChange(
                        "allowCrossAgentComm",
                        checked
                      )
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Log Sensitive Data</Label>
                    <p className="text-sm text-muted-foreground">
                      Include sensitive data in logs (not recommended)
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.logSensitiveData}
                    onCheckedChange={(checked) =>
                      handleSecuritySettingsChange("logSensitiveData", checked)
                    }
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={() => handleSaveSettings("security")}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Data Management */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Manage your platform data and storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Local Storage</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  This platform stores all data in your browser's localStorage.
                  No data is sent to any servers unless you configure MCP
                  servers.
                </p>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear All Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center">
                        <ShieldAlert className="h-5 w-5 mr-2 text-destructive" />
                        Clear All Data
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all agents, crews, logs, and other data
                        from your browser's localStorage. Settings will be
                        preserved. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleClearAllData}
                      >
                        Yes, Clear Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Data Export/Import</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Export your data to a file or import from a previously
                  exported file.
                </p>

                <div className="flex gap-2">
                  <Button variant="outline">Export All Data</Button>
                  <Button variant="outline">Import Data</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
