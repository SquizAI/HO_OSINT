import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building, User, Target, DollarSign, MapPin, Calendar,
  TrendingUp, Users, Clock, Activity, Star, AlertCircle
} from 'lucide-react';

interface HoverCardProps {
  children: React.ReactNode;
  data: any;
  type: 'project' | 'company' | 'person' | 'lead';
  delay?: number;
}

export const HoverCard: React.FC<HoverCardProps> = ({ 
  children, 
  data, 
  type,
  delay = 500 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const cardRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      // Add null check to prevent error
      if (!e.currentTarget) return;
      
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect) return;
      
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceRight = window.innerWidth - rect.right;
      
      let x = rect.left;
      let y = rect.bottom + 8;
      
      // Adjust if not enough space below
      if (spaceBelow < 300) {
        y = rect.top - 308;
      }
      
      // Adjust if not enough space on right
      if (spaceRight < 320) {
        x = rect.right - 320;
      }
      
      setPosition({ x, y });
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const renderProjectCard = () => (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{data.name}</h3>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <MapPin className="w-3 h-3" />
            {data.location || 'Location TBD'}
          </p>
        </div>
        <Target className="w-8 h-8 text-purple-500" />
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 rounded-lg p-2">
          <p className="text-xs text-green-600 font-medium">Value</p>
          <p className="text-lg font-bold text-green-700">
            ${((data.budget || 0) / 1000000).toFixed(1)}M
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2">
          <p className="text-xs text-blue-600 font-medium">Status</p>
          <p className="text-sm font-semibold text-blue-700 capitalize">
            {data.status?.replace('_', ' ') || 'Active'}
          </p>
        </div>
      </div>
      
      {data.description && (
        <p className="text-sm text-gray-600 line-clamp-2">
          {data.description}
        </p>
      )}
      
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Calendar className="w-3 h-3" />
          <span>Added {new Date(data.created_at || Date.now()).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star 
              key={i} 
              className={`w-3 h-3 ${i < 4 ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
            />
          ))}
        </div>
      </div>
      
      <div className="flex gap-2">
        <button className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
          View Details
        </button>
        <button className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
          Start Research
        </button>
      </div>
    </div>
  );

  const renderCompanyCard = () => (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{data.name}</h3>
          <p className="text-sm text-gray-500">{data.industry || 'Industry'}</p>
        </div>
        <Building className="w-8 h-8 text-blue-500" />
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{data.employee_count || 'N/A'}</p>
          <p className="text-xs text-gray-500">Employees</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{data.project_count || '0'}</p>
          <p className="text-xs text-gray-500">Projects</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{data.rating || 'N/A'}</p>
          <p className="text-xs text-gray-500">Rating</p>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">ICP Score</span>
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full" style={{width: '85%'}}></div>
            </div>
            <span className="font-semibold text-green-600">85%</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-xs">
        <Activity className="w-3 h-3 text-green-500" />
        <span className="text-gray-600">Last activity: 2 days ago</span>
      </div>
      
      <div className="flex gap-2">
        <button className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
          View Profile
        </button>
        <button className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
          Quick Contact
        </button>
      </div>
    </div>
  );

  const renderPersonCard = () => (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {data.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{data.name}</h3>
            <p className="text-sm text-gray-600">{data.title || 'Professional'}</p>
            <p className="text-xs text-gray-500">{data.company}</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-lg p-2">
          <p className="text-xs text-blue-600 font-medium">Network</p>
          <p className="text-lg font-bold text-blue-700">
            {data.connection_count || '250+'}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-2">
          <p className="text-xs text-green-600 font-medium">Influence</p>
          <p className="text-lg font-bold text-green-700">High</p>
        </div>
      </div>
      
      {data.golf_clubs && data.golf_clubs.length > 0 && (
        <div className="bg-purple-50 rounded-lg p-2">
          <p className="text-xs text-purple-600 font-medium mb-1">Golf Network</p>
          <p className="text-sm text-purple-700">{data.golf_clubs[0]}</p>
        </div>
      )}
      
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Clock className="w-3 h-3" />
        <span>Last contacted: Never</span>
      </div>
      
      <div className="flex gap-2">
        <button className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors">
          View Profile
        </button>
        <button className="flex-1 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
          Add Note
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (type) {
      case 'project':
        return renderProjectCard();
      case 'company':
        return renderCompanyCard();
      case 'person':
        return renderPersonCard();
      default:
        return null;
    }
  };

  return (
    <>
      <div 
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: position.x,
              top: position.y,
              zIndex: 9999
            }}
            className="w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={handleMouseLeave}
          >
            {renderContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default HoverCard;