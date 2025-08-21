import React, { createContext, useContext, useState, ReactNode } from 'react';

// Navigation types
export type ViewType = 'dashboard' | 'person' | 'project' | 'company' | 'lead' | 'research' | 'golf' | 'analytics' | 'map' | 'bpda' | 'icp' | 'timeline' | 'people-list' | 'companies-list' | 'projects-list' | 'agents' | 'research-settings' | 'test-firecrawl';

export interface NavigationState {
  currentView: ViewType;
  entityId?: string;
  entityType?: string;
  breadcrumbs: Array<{
    label: string;
    view: ViewType;
    entityId?: string;
  }>;
}

export interface NavigationContextType {
  navigationState: NavigationState;
  navigateTo: (view: ViewType, entityId?: string, entityType?: string, label?: string) => void;
  navigateBack: () => void;
  navigateToDashboard: () => void;
  navigateToPerson: (personId: string, personName?: string) => void;
  navigateToProject: (projectId: string, projectName?: string) => void;
  navigateToCompany: (companyId: string, companyName?: string) => void;
  navigateToLead: (leadId: string, leadName?: string) => void;
  navigateToResearch: (entityType: string, entityId: string, entityName?: string) => void;
  navigateToGolf: () => void;
  navigateToAnalytics: () => void;
  navigateToMap: () => void;
  navigateToBPDA: () => void;
  navigateToICP: () => void;
  navigateToTimeline: () => void;
  navigateToPeopleList: () => void;
  navigateToCompaniesList: () => void;
  navigateToProjectsList: () => void;
  navigateToAgents: () => void;
  navigateToResearchSettings: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

interface NavigationProviderProps {
  children: ReactNode;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentView: 'dashboard',
    breadcrumbs: [{ label: 'Dashboard', view: 'dashboard' }]
  });

  // Generic navigation handler
  const navigateTo = (
    view: ViewType,
    entityId?: string,
    entityType?: string,
    label?: string
  ) => {
    console.log('🔍 NavigationProvider: navigateTo called with:', JSON.stringify({
      view,
      entityId,
      entityType,
      label,
      entityIdType: typeof entityId,
      entityIdLength: entityId?.length
    }, null, 2));

    const newBreadcrumb = {
      label: label || `${view.charAt(0).toUpperCase() + view.slice(1)} ${entityId ? `#${entityId}` : ''}`,
      view,
      entityId
    };

    setNavigationState(prev => {
      const newState = {
        currentView: view,
        entityId,
        entityType,
        breadcrumbs: [...prev.breadcrumbs, newBreadcrumb]
      };

      console.log('🔍 NavigationProvider: Setting new navigation state:', JSON.stringify(newState, null, 2));
      
      // Force a re-render by triggering a state update
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('navigation-change', { detail: newState }));
      }, 0);
      
      return newState;
    });
  };

  // Navigate back in the breadcrumb trail
  const navigateBack = () => {
    setNavigationState(prev => {
      const newBreadcrumbs = prev.breadcrumbs.slice(0, -1);
      const lastBreadcrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
      
      return {
        currentView: lastBreadcrumb.view,
        entityId: lastBreadcrumb.entityId,
        breadcrumbs: newBreadcrumbs
      };
    });
  };

  // Reset to dashboard
  const navigateToDashboard = () => {
    setNavigationState({
      currentView: 'dashboard',
      breadcrumbs: [{ label: 'Dashboard', view: 'dashboard' }]
    });
  };

  // Specific navigation methods
  const navigateToPerson = (personId: string, personName?: string) => {
    navigateTo('person', personId, 'person', personName || `Person ${personId}`);
  };

  const navigateToProject = (projectId: string, projectName?: string) => {
    console.log('🔍 NavigationProvider: navigateToProject called with:', JSON.stringify({
      projectId,
      projectName,
      type: typeof projectId,
      length: projectId?.length,
      isEmpty: !projectId || projectId.trim() === ''
    }, null, 2));
    navigateTo('project', projectId, 'project', projectName || `Project ${projectId}`);
  };

  const navigateToCompany = (companyId: string, companyName?: string) => {
    navigateTo('company', companyId, 'company', companyName || `Company ${companyId}`);
  };

  const navigateToLead = (leadId: string, leadName?: string) => {
    navigateTo('lead', leadId, 'lead', leadName || `Lead ${leadId}`);
  };

  const navigateToResearch = (entityType: string, entityId: string, entityName?: string) => {
    navigateTo('research', entityId, entityType, `Research: ${entityName || entityId}`);
  };

  const navigateToGolf = () => {
    navigateTo('golf', undefined, undefined, 'Golf Network');
  };

  const navigateToAnalytics = () => {
    navigateTo('analytics', undefined, undefined, 'Analytics Dashboard');
  };

  const navigateToMap = () => {
    navigateTo('map', undefined, undefined, 'Projects Map');
  };

  const navigateToBPDA = () => {
    navigateTo('bpda', undefined, undefined, 'BPDA Manager');
  };

  const navigateToICP = () => {
    navigateTo('icp', undefined, undefined, 'ICP Settings');
  };

  const navigateToTimeline = () => {
    navigateTo('timeline', undefined, undefined, 'Timeline View');
  };

  const navigateToPeopleList = () => {
    navigateTo('people-list', undefined, undefined, 'All People');
  };

  const navigateToCompaniesList = () => {
    navigateTo('companies-list', undefined, undefined, 'All Companies');
  };

  const navigateToProjectsList = () => {
    navigateTo('projects-list', undefined, undefined, 'All Projects');
  };

  const navigateToAgents = () => {
    navigateTo('agents', undefined, undefined, 'AI Agents');
  };

  const navigateToResearchSettings = () => {
    navigateTo('research-settings', undefined, undefined, 'Research Settings');
  };

  const contextValue: NavigationContextType = {
    navigationState,
    navigateTo,
    navigateBack,
    navigateToDashboard,
    navigateToPerson,
    navigateToProject,
    navigateToCompany,
    navigateToLead,
    navigateToResearch,
    navigateToGolf,
    navigateToAnalytics,
    navigateToMap,
    navigateToBPDA,
    navigateToICP,
    navigateToTimeline,
    navigateToPeopleList,
    navigateToCompaniesList,
    navigateToProjectsList,
    navigateToAgents,
    navigateToResearchSettings
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
}; 