/* Generated from current scanner; exact eye-mask and material functions. */
(function(){const THREE=AFRAME.THREE;const debugLog=()=>{};
        function createEyeEmissionMask(texture) {
            if (!texture || !texture.image) return null;
            const image = texture.image;
            const canvas = document.createElement('canvas');
            canvas.width = image.width; canvas.height = image.height;
            const context = canvas.getContext('2d');
            try {
                context.drawImage(image, 0, 0);
                const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < pixels.data.length; i += 4) {
                    const red = pixels.data[i], green = pixels.data[i + 1], blue = pixels.data[i + 2];
                    const value = Math.round(255 * THREE.MathUtils.clamp(((green + blue) / 2 - red * 1.1) / 50, 0, 1));
                    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
                    pixels.data[i + 3] = 255;
                }
                context.putImageData(pixels, 0, 0);
                const mask = new THREE.CanvasTexture(canvas);
                mask.flipY = texture.flipY;
                mask.colorSpace = THREE.NoColorSpace;
                mask.wrapS = texture.wrapS; mask.wrapT = texture.wrapT;
                return mask;
            } catch (error) {
                debugLog('eye-mask-unavailable');
                return null;
            }
        }
        function enhanceMaterial(m) {
            if (!m.userData.spiritOriginal) m.userData.spiritOriginal = {
                roughness: m.roughness, metalness: m.metalness, map: m.map,
                normalMap: m.normalMap, roughnessMap: m.roughnessMap
            };
            const isRuneArm = !!m.emissiveMap;
            const isHead = m.name === 'gray.002';
            if (isRuneArm || isHead) {
                if (!m.emissiveMap && isHead) m.emissiveMap = createEyeEmissionMask(m.map);
                if (m.emissiveMap) {
                    m.emissive = new THREE.Color(0x00f0ff);
                    m.emissiveIntensity = 0.6;
                }
            }
            m.needsUpdate = true;
        }


window.SpiritReviewReference={enhance:enhanceMaterial};})();
