import React from 'react';
import { motion } from 'framer-motion';

export const CardSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 rounded w-4/6"></div>
      </div>
      <div className="flex gap-2 mt-6">
        <div className="h-10 bg-gray-200 rounded w-20"></div>
        <div className="h-10 bg-gray-200 rounded w-20"></div>
      </div>
    </div>
  );
};

export const PhotoSkeleton = () => {
  return (
    <div className="w-32 h-32 bg-gray-200 rounded-lg animate-pulse"></div>
  );
};

export const ProposalSkeleton = () => {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-gradient-to-br from-pink-100 via-purple-100 to-rose-100">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white/50 backdrop-blur-xl rounded-3xl p-10 max-w-lg w-full shadow-2xl"
      >
        <div className="w-full h-72 bg-gray-200 rounded-2xl mb-6 animate-pulse"></div>
        <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-8 animate-pulse"></div>
        <div className="flex gap-6 justify-center">
          <div className="h-14 bg-gray-200 rounded-full w-32 animate-pulse"></div>
          <div className="h-14 bg-gray-200 rounded-full w-32 animate-pulse"></div>
        </div>
      </motion.div>
    </div>
  );
};

export const GridSkeleton = ({ count = 6 }) => {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
};
