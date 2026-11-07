import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function executeLocalBridgeCommand(command) {
    console.log(`[PC-Bridge] Prijatý príkaz na vykonanie: ${command}`);
    try {
        const { stdout, stderr } = await execAsync(command, { shell: 'powershell.exe' });
        return { success: true, stdout, stderr };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
