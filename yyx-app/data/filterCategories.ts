import { FilterCategory } from '@/types/filterCategory';
import { IMAGES } from '@/constants/images';

export const filterCategories: FilterCategory[] = [
  {
    id: '1',
    name: 'Plato Principal',
    tag: 'plato-principal',
    // imageUrl: IMAGES.FILTER_CATEGORIES.MAIN,
    imageUrl: IMAGES.FILTER_CATEGORIES.PLACEHOLDER,
  },
  {
    id: '2',
    name: 'Verduras',
    tag: 'verduras',
    // imageUrl: IMAGES.FILTER_CATEGORIES.VERDURAS,
    imageUrl: IMAGES.FILTER_CATEGORIES.PLACEHOLDER,
  },
  {
    id: '3',
    name: 'Postre',
    tag: 'postre',
    // imageUrl: IMAGES.FILTER_CATEGORIES.DESSERT,
    imageUrl: IMAGES.FILTER_CATEGORIES.PLACEHOLDER,
  },
  {
    id: '5',
    name: 'Panadería',
    tag: 'panaderia',
    // imageUrl: IMAGES.FILTER_CATEGORIES.PANADERIA,
    imageUrl: IMAGES.FILTER_CATEGORIES.PLACEHOLDER,
  },
  {
    id: '4',
    name: 'Sopas y cremas',
    tag: ['sopa', 'crema'],
    // imageUrl: IMAGES.FILTER_CATEGORIES.BREAKFAST,
    imageUrl: IMAGES.FILTER_CATEGORIES.PLACEHOLDER,
  },
  {
    id: '6',
    name: 'Bebidas',
    tag: 'bebidas',
    // imageUrl: IMAGES.FILTER_CATEGORIES.DRINK,
    imageUrl: IMAGES.FILTER_CATEGORIES.PLACEHOLDER,
  },
  {
    id: '7',
    name: 'Arroz',
    tag: 'arroz',
    imageUrl: IMAGES.FILTER_CATEGORIES.PLACEHOLDER,
  },
  {
    id: '8',
    name: 'Pasta',
    tag: 'pasta',
    imageUrl: IMAGES.FILTER_CATEGORIES.PLACEHOLDER,
  },
]; 