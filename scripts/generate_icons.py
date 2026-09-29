import zlib
import struct
import math

def write_png(filename, width, height, is_maskable=False):
    # Generates a clean PNG image for the PWA icon
    # Blue gradient background with a water jar and droplet motif
    raw_data = bytearray()
    
    # Precompute center and scale
    cx = width / 2.0
    cy = height / 2.0
    scale = width / 512.0
    corner_radius = 112.0 * scale if not is_maskable else 0

    for y in range(height):
        # Filter type 0 (None)
        raw_data.append(0)
        
        # Vertical gradient factor [0.0 -> 1.0]
        v_factor = y / height
        
        for x in range(width):
            # Compute distance for rounded corners if not maskable
            in_bounds = True
            if not is_maskable:
                # Rounded rect check
                dx = max(abs(x - cx) - (cx - corner_radius), 0)
                dy = max(abs(y - cy) - (cy - corner_radius), 0)
                if dx * dx + dy * dy > corner_radius * corner_radius:
                    in_bounds = False
            
            if not in_bounds:
                raw_data.extend([0, 0, 0, 0]) # Transparent
                continue
            
            # Base background color: Gradient from #0284c7 (2, 132, 199) to #075985 (7, 89, 133)
            r = int(2 + (7 - 2) * v_factor)
            g = int(132 + (89 - 132) * v_factor)
            b = int(199 + (133 - 199) * v_factor)
            a = 255

            # Coordinates relative to center
            nx = (x - cx) / scale
            ny = (y - cy) / scale
            
            # Check if inside jar body
            # Cap: x in [-34, 34], y in [-170, -146]
            if -34 <= nx <= 34 and -170 <= ny <= -146:
                r, g, b = 248, 250, 252
            # Neck: x in [-24, 24], y in [-146, -118]
            elif -24 <= nx <= 24 and -146 <= ny <= -118:
                r, g, b = 226, 232, 240
            # Bottle body:
            elif -110 <= nx <= 110 and -118 <= ny <= 160:
                # Bottle width shrinks towards neck
                allowed_w = 110
                if ny < 0:
                    t = (ny + 118) / 118.0
                    allowed_w = 24 + (110 - 24) * t
                elif ny > 110:
                    t = (160 - ny) / 50.0
                    allowed_w = 110 * max(0, t)

                if abs(nx) <= allowed_w:
                    # Inside bottle!
                    # Droplet inside bottle
                    # Center at ny = 40, rx=48, ry=60
                    ddx = nx / 45.0
                    ddy = (ny - 35) / 55.0
                    dist_drop = ddx * ddx + ddy * ddy
                    if dist_drop <= 1.0 and ny >= -40:
                        # Deep sky blue droplet
                        r, g, b = 2, 132, 199
                    else:
                        # Cyan bottle body
                        r = int(186 + (125 - 186) * ((ny + 118) / 278.0))
                        g = int(230 + (211 - 230) * ((ny + 118) / 278.0))
                        b = int(253 + (252 - 253) * ((ny + 118) / 278.0))
                        # Ribs lines
                        if abs(ny - (-20)) < 3 or abs(ny - 35) < 3 or abs(ny - 90) < 3:
                            r, g, b = 56, 189, 248

            raw_data.extend([r, g, b, a])

    # Construct PNG file
    png = bytearray(b'\x89PNG\r\n\x1a\n')
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png.extend(struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc))
    
    # IDAT chunk
    compressed = zlib.compress(raw_data, 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    png.extend(struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc))
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    png.extend(struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc))

    with open(filename, 'wb') as f:
        f.write(png)
    print(f"Generated {filename} ({width}x{height})")

write_png("public/pwa-192x192.png", 192, 192)
write_png("public/pwa-512x512.png", 512, 512)
write_png("public/pwa-maskable-512x512.png", 512, 512, is_maskable=True)
write_png("public/apple-touch-icon.png", 180, 180)
print("All icons successfully created.")
