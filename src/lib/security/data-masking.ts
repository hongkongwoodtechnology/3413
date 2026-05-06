/**
 * Utility functions for data masking to protect sensitive information.
 */

/**
 * Masks a wallet address.
 * Example: "7xV9p2aB4c...8dF" -> "7xV9...8dF"
 */
export function maskWalletAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Masks an IP address.
 * Example: "192.168.1.100" -> "192.168.*.*"
 */
export function maskIpAddress(ip: string): string {
    if (!ip) return ip;
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.*.*`;
    }
    return ip; // Return as is if not standard IPv4
}

/**
 * Masks an Admin username.
 * Example: "admin_super" -> "ad***er"
 */
export function maskAdminName(name: string): string {
    if (!name || name.length <= 4) return name;
    return `${name.slice(0, 2)}***${name.slice(-2)}`;
}
