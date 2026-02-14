import React, { useState, useRef, useEffect, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Float, Text, Image as DreiImage } from '@react-three/drei';
import { Button } from '@/components/ui/button';
import { useMobile } from '@/hooks/useMobile';
import * as THREE from 'three';
import { toast } from 'sonner';

// ==================== FALLING HEARTS (BACKGROUND) ====================

function FallingHeart({ position, speed, rotationSpeed, scale }) {
  const ref = useRef();
  
  useFrame((state) => {
    if (!ref.current) return;
    
    // Fall down
    ref.current.position.y -= speed;
    
    // Rotate
    ref.current.rotation.z += rotationSpeed;
    ref.current.rotation.y += rotationSpeed * 0.5;
    
    // Reset if out of view
    if (ref.current.position.y < -15) {
      ref.current.position.y = 15;
      ref.current.position.x = (Math.random() - 0.5) * 20;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <Text
        ref={ref}
        position={position}
        fontSize={scale}
        color="#ff3366"
        anchorX="center"
        anchorY="middle"
      >
        ❤️
      </Text>
    </Float>
  );
}

function FallingHeartsScene({ count = 30 }) {
  const hearts = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      position: [(Math.random() - 0.5) * 20, Math.random() * 30 - 15, (Math.random() - 0.5) * 10],
      speed: 0.02 + Math.random() * 0.05,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
      scale: 0.5 + Math.random() * 1
    }));
  }, [count]);

  return (
    <>
      {hearts.map((heart) => (
        <FallingHeart key={heart.id} {...heart} />
      ))}
    </>
  );
}

// ==================== FALLING IMAGES (ACCEPTED PAGE) ====================

function FallingImage({ allPhotos, initialUrl, position, speed }) {
  const ref = useRef();
  const [url, setUrl] = useState(initialUrl);
  
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y -= speed;
    if (ref.current.position.y < -15) {
      ref.current.position.y = 15;
      ref.current.position.x = (Math.random() - 0.5) * 15;
      
      // Pick new random photo
      if (allPhotos && allPhotos.length > 0) {
          const next = allPhotos[Math.floor(Math.random() * allPhotos.length)];
          if (next && next.file_url) {
            setUrl(next.file_url);
          }
      }
    }
  });

  return (
    <DreiImage 
      ref={ref} 
      url={url} 
      transparent 
      scale={[3, 3]} 
      position={position}
    />
  );
}

function FallingImagesScene({ photos }) {
  const { isMobile } = useMobile();
  const count = 4; // Requirement: "At a time: 4 images"
  
  // Create 4 slots
  const [activePhotos, setActivePhotos] = useState([]);

  useEffect(() => {
    if (!photos || photos.length === 0) return;
    
    // Initialize 4 photos with random start positions
    const initial = Array.from({ length: count }, (_, i) => ({
        id: i,
        initialUrl: photos[i % photos.length].file_url,
        position: [(Math.random() - 0.5) * 15, Math.random() * 20 - 5, 0],
        speed: 0.02 + Math.random() * 0.03
    }));
    setActivePhotos(initial);
  }, [photos]);

  if (!activePhotos.length) return null;

  return (
    <>
      {activePhotos.map((photo) => (
        <FallingImage key={photo.id} {...photo} allPhotos={photos} />
      ))}
    </>
  );
}

// ==================== REJECT WRAPPER (UI) ====================

function RejectWrapper({ photos }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [imageIndex, setImageIndex] = useState(0);
  const { isMobile } = useMobile();

  // Loop images
  useEffect(() => {
    if (!photos || photos.length === 0) return;
    const interval = setInterval(() => {
        setImageIndex(prev => (prev + 1) % photos.length);
    }, 2000); // Change image every 2 seconds
    return () => clearInterval(interval);
  }, [photos]);

  const moveButton = () => {
    const maxMove = isMobile ? 100 : 250;
    const x = (Math.random() - 0.5) * maxMove * 2;
    const y = (Math.random() - 0.5) * maxMove * 2;
    setPosition({ x, y });
  };

  const currentPhoto = (photos && photos.length > 0) ? photos[imageIndex] : null;

  return (
    <motion.div
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
      className="absolute z-50 flex flex-col items-center gap-0 cursor-pointer" // gap-0 to attach strictly
      onMouseEnter={moveButton}
      onTouchStart={moveButton}
    >
      {/* Image attached strictly to top */}
      {currentPhoto && (
        <motion.div 
            key={currentPhoto.file_url}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mb-0" // Ensure no gap
        >
             <img 
                src={currentPhoto.file_url} 
                alt="Proposal" 
                className="w-32 h-32 md:w-48 md:h-48 object-cover rounded-t-xl shadow-xl border-4 border-white border-b-0 bg-white"
             />
        </motion.div>
      )}
      
      {/* Reject Button */}
      <Button 
        variant="destructive" 
        className={`rounded-b-xl rounded-t-none px-8 py-6 text-lg font-bold shadow-xl border-4 border-white border-t-0 w-32 md:w-48 ${!currentPhoto && 'rounded-xl border-t-4'}`}
        onClick={moveButton}
      >
        Reject 💔
      </Button>
    </motion.div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function ProposalScene({ proposalData }) {
  const [accepted, setAccepted] = useState(false);
  const [audio] = useState(new Audio());

  // Get photos
  const photosBefore = useMemo(() => 
    proposalData?.categories?.flatMap(c => c.photos_before || []) || [], 
  [proposalData]);

  const allPhotos = useMemo(() => 
    proposalData?.categories?.flatMap(c => [...(c.photos_before || []), ...(c.photos_after || [])]) || [], 
  [proposalData]);

  const handleAccept = () => {
    setAccepted(true);
    toast.success("She said YES! 💍");
    // Play music logic if needed (handled by parent or here)
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-pink-100 via-rose-100 to-purple-100">
      
      {/* 3D Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
          <ambientLight intensity={0.8} />
          <pointLight position={[10, 10, 10]} />
          
          {accepted ? (
            <FallingImagesScene photos={allPhotos} />
          ) : (
             <FallingHeartsScene />
          )}
        </Canvas>
      </div>

      {/* Foreground UI */}
      <div className="relative z-10 w-full h-full flex items-center justify-center pointer-events-none">
        
        {/* Proposal State */}
        {!accepted && (
           <>
              {/* Accept Button - Static Centered */}
              <div className="pointer-events-auto z-40 transform transition-transform hover:scale-110 active:scale-95">
                  <Button 
                    onClick={handleAccept}
                    className="bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-2xl px-12 py-8 rounded-full shadow-2xl border-4 border-white/50 animate-pulse"
                  >
                    Accept 💍
                  </Button>
              </div>

              {/* Reject Wrapper - Moving */}
              <div className="absolute pointer-events-auto">
                 <RejectWrapper photos={photosBefore} />
              </div>
           </>
        )}

        {/* Accepted State */}
        {accepted && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center bg-white/30 backdrop-blur-md p-8 rounded-3xl border border-white/50 shadow-2xl"
          >
             <h1 className="text-6xl md:text-8xl mb-4">❤️</h1>
             <h2 className="text-4xl md:text-6xl font-bold text-pink-600 drop-shadow-lg" style={{ fontFamily: 'Dancing Script, cursive' }}>
               She Said YES!
             </h2>
             <p className="text-xl md:text-2xl text-pink-800 mt-4 font-medium">
               Forever & Always
             </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
