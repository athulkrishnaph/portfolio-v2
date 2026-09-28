import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';
import { unsavedChangesGuard } from './features/admin/shared/unsaved-changes.guard';
import { AdminLayout } from './layouts/admin-layout/admin-layout';
import { PublicLayout } from './layouts/public-layout/public-layout';

/**
 * Every page is lazy-loaded (loadComponent), so visitors of the public site
 * never download the admin code and vice versa.
 */
export const routes: Routes = [
  // ---- Public site ---------------------------------------------------------
  {
    path: '',
    component: PublicLayout,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/public/home/home').then((m) => m.Home),
      },
      {
        path: 'about',
        title: 'About',
        loadComponent: () => import('./features/public/about/about').then((m) => m.About),
      },
      {
        path: 'skills',
        title: 'Skills',
        loadComponent: () => import('./features/public/skills/skills').then((m) => m.Skills),
      },
      {
        path: 'projects',
        title: 'Projects',
        loadComponent: () => import('./features/public/projects/projects').then((m) => m.Projects),
      },
      {
        path: 'projects/:slug',
        title: 'Project',
        loadComponent: () =>
          import('./features/public/project-detail/project-detail').then((m) => m.ProjectDetail),
      },
      {
        path: 'experience',
        title: 'Experience',
        loadComponent: () =>
          import('./features/public/experience/experience').then((m) => m.ExperiencePage),
      },
      {
        path: 'education',
        title: 'Education',
        loadComponent: () =>
          import('./features/public/education/education').then((m) => m.EducationPage),
      },
      {
        path: 'certificates',
        title: 'Certificates',
        loadComponent: () =>
          import('./features/public/certificates/certificates').then((m) => m.CertificatesPage),
      },
      {
        path: 'contact',
        title: 'Contact',
        loadComponent: () => import('./features/public/contact/contact').then((m) => m.Contact),
      },
    ],
  },

  // ---- Admin login (no admin chrome) ---------------------------------------
  {
    path: 'admin/login',
    title: 'Admin login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/admin/login/login').then((m) => m.Login),
  },

  // ---- Admin portal: every child route requires a valid session ------------
  {
    path: 'admin',
    component: AdminLayout,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'profile',
        title: 'Profile',
        canDeactivate: [unsavedChangesGuard],
        loadComponent: () =>
          import('./features/admin/profile/profile-admin').then((m) => m.ProfileAdmin),
      },
      ...crudRoutes(
        'projects',
        'Projects',
        'project',
        () => import('./features/admin/projects/project-list').then((m) => m.ProjectList),
        () => import('./features/admin/projects/project-form').then((m) => m.ProjectForm),
      ),
      ...crudRoutes(
        'certificates',
        'Certificates',
        'certificate',
        () =>
          import('./features/admin/certificates/certificate-list').then((m) => m.CertificateList),
        () =>
          import('./features/admin/certificates/certificate-form').then((m) => m.CertificateForm),
      ),
      ...crudRoutes(
        'experience',
        'Experience',
        'experience',
        () => import('./features/admin/experience/experience-list').then((m) => m.ExperienceList),
        () => import('./features/admin/experience/experience-form').then((m) => m.ExperienceForm),
      ),
      ...crudRoutes(
        'education',
        'Education',
        'education',
        () => import('./features/admin/education/education-list').then((m) => m.EducationList),
        () => import('./features/admin/education/education-form').then((m) => m.EducationForm),
      ),
      {
        path: 'skills',
        title: 'Skills',
        loadComponent: () =>
          import('./features/admin/skills/skills-admin').then((m) => m.SkillsAdmin),
      },
    ],
  },

  // ---- Fallback ------------------------------------------------------------
  {
    path: '**',
    component: PublicLayout,
    children: [
      {
        path: '',
        title: 'Page not found',
        loadComponent: () =>
          import('./features/public/not-found/not-found').then((m) => m.NotFound),
      },
    ],
  },
];

type ComponentLoader = NonNullable<Routes[number]['loadComponent']>;

/** list / new / :id/edit routes shared by every admin resource. */
function crudRoutes(
  path: string,
  plural: string,
  singular: string,
  list: ComponentLoader,
  form: ComponentLoader,
): Routes {
  return [
    { path, title: plural, loadComponent: list },
    {
      path: `${path}/new`,
      title: `New ${singular}`,
      canDeactivate: [unsavedChangesGuard],
      loadComponent: form,
    },
    {
      path: `${path}/:id/edit`,
      title: `Edit ${singular}`,
      canDeactivate: [unsavedChangesGuard],
      loadComponent: form,
    },
  ];
}
