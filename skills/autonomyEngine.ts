import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export class TrinityAutonomyEngine {
  public static async executeSystemCommand(command: string): Promise<{ success: boolean; output: string }> {
    try {
      console.log(`[AUTONOMY] Vykonávam systémový príkaz: ${command}`);
      const { stdout, stderr } = await execAsync(command, { shell: "powershell.exe" });
      return { success: true, output: stdout || stderr };
    } catch (error: any) {
      return { success: false, output: error.message };
    }
  }

  public static scaffoldProject(name: string, template: string = "node"): string {
    const dir = path.join(process.cwd(), "generated_apps", name);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "README.md"), `# Projekt ${name}\nGenerované autonómne cez TRINITY OMNI-CORE (šablóna: ${template}).\n`);
    }
    return `Projekt "${name}" bol pripravený v ${dir}`;
  }
}
